# 저축/이체 분류 단순화 설계 문서

## 1. 배경

뱅크샐러드에서 내려받은 원본 데이터가 가끔 계좌 간 내부 이동(예: 특정 증권사로의 이체)을 `이체` 타입이 아니라 `지출` 타입으로 잘못 표기하는 경우가 발견됐다 (2월/3월 데이터). 기존 `classification.ts`는 이런 케이스를 카테고리 매칭(`대분류==투자`, `소분류==증권/투자`)으로 자동 탐지해 "저축"으로 분류하려 시도하지만, 소스 데이터의 카테고리 표기 자체가 일관적이지 않아 탐지에 실패하면 그대로 "지출"로 잡혀 저축액이 실제보다 적게 계산된다.

사용자와의 논의 결과, 다음 방향으로 합의했다:

1. 거래 단위로 "이게 저축이다"를 신뢰성 낮은 규칙으로 추정하는 대신, **저축/투자 총액은 월별 순수입 − 순지출의 잔차(residual)로 계산**한다. 대시보드의 "실질 저축률" KPI가 이미 이 공식을 쓰고 있어 새 개념이 아니라 기존 두 계산 방식(분류-합산 vs 잔차)의 불일치를 해소하는 것에 가깝다.
2. 자동 탐지가 실패하는 케이스(내 계좌 간 이동인데 `지출`/`수입`으로 잘못 찍힌 거래)는 **거래관리 화면에서 사용자가 직접 "이체로 제외" 처리**한다. 자동 판별 규칙을 정교하게 만드는 대신, 사람이 예외를 눈으로 보고 지정하는 쪽을 택했다.

## 2. 분류 모델 변경

### 2.1 `FlowType` 축소

`income | saving | spending | neutral` → **`income | spending | neutral`**

`saving`은 더 이상 거래 단위 분류값으로 존재하지 않는다. 기존에 `'saving'`을 반환하던 모든 자동 규칙은 `'neutral'`을 반환하도록 바뀐다 — 실질적으로는 "지출 집계에서 제외된다"는 동작 자체는 그대로 유지되고, 별도 저축 버킷에 합산하던 로직만 없어진다.

`flowTypeOverride`: `saving | spending | null` → **`spending | neutral | null`**. 새 값 `'neutral'`이 이번에 추가하는 수동 "이체로 제외" 오버라이드다.

`ClassificationRule.flowType` (가맹점/결제수단 기반 커스텀 규칙): `saving | spending` → **`spending | neutral`**.

### 2.2 `src/lib/classification.ts` 규칙 변경

| 기존 규칙 | 기존 반환값 | 변경 후 반환값 |
|---|---|---|
| 결제수단이 주택청약종합저축/NH청년도약계좌/월세 보증금 & 유출 | `saving` | `neutral` |
| 타입==이체 && 대분류==투자 | 유출 시 `saving`, 유입 시 `income` | 방향 무관 항상 `neutral` |
| 타입==지출 && 대분류==금융 && 소분류==증권/투자 | `saving` | `neutral` |
| (나머지 이체 규칙들 — 카드대금, 페어매칭, 미매칭) | `neutral` | 변경 없음 |

`이체 && 대분류==투자`의 유입 케이스를 더 이상 `income`으로 잡지 않는 이유: "내 계좌 간 이동은 수입도 지출도 아니다"라는 이번 논의의 원칙을 이체 자체에도 동일하게 적용하기 위함이다.

### 2.3 `src/lib/aggregations.ts` — 저축액 계산 방식 변경

`summarizeByMonth`에서 `saving` 필드를 거래 합산이 아니라 **`Math.max(0, income - spending)`**으로 계산한다.

```ts
const income = bucket.income
const spending = Math.max(0, -bucket.spending)
const saving = Math.max(0, income - spending)  // was: Math.max(0, -bucket.saving)
const netCashFlow = income - spending  // unclamped — negative in an overspend month
```

`netCashFlow`는 기존에도 `income - spending - saving`이었는데, 새 `saving` 정의 하에서는 `income - spending - max(0, income-spending)`이 되어 흑자 달엔 항상 0, 적자 달엔 `income - spending`(음수)이 된다. 적자 달의 신호를 그대로 보존하기 위해 `netCashFlow`는 `income - spending`으로 직접 계산하도록 바꾼다 (표시상 무의미해지는 것 방지).

**하위 호환**: `KpiCards`, `MonthSummaryCard`, `MonthlyTrendChart`는 전부 `MonthlySummary.saving`/`netCashFlow` 필드를 그대로 소비하므로 **코드 수정이 필요 없다** — 계산 방식만 바뀌고 인터페이스는 동일하다.

**예외**: `DashboardPage.tsx`의 `totals` 계산(26-40행 부근)은 `summarizeByMonth`가 반환한 월별 `saving`을 그대로 합산하지만, `netCashFlow`는 `aggregations.ts`를 거치지 않고 **자체적으로 `income - spending - saving`을 다시 계산**하고 있다. 여기도 동일한 이유로 `netCashFlow = income - spending`(unclamped)로 고쳐야 한다 — 안 그러면 흑자 기간엔 이 값이 항상 0 근처로 뭉개진다. `savingsRate`는 이미 `(income-spending)/income`이라 그대로 둔다.

### 2.4 `src/lib/dashboardAggregations.ts` — `includeSaving` 제거

`bucketBySpending`/`categoryBreakdown`/`subcategoryBreakdown`의 `includeSaving` 매개변수를 제거한다 (더 이상 `resolvedFlowType === 'saving'`인 거래가 존재하지 않으므로 항상 no-op이 됨).

`CategoryDonut.tsx`의 "저축 포함" 토글 UI를 제거한다.

## 3. 기존 데이터 재분류

`useTransactionStore.importRows`는 이미 매 호출마다 스토어의 전체 거래를 다시 `classifyFlowType`으로 재계산해 upsert하는 구조라 (새 데이터 유무와 무관), 알고리즘 배포 후 아무 파일이나 다시 불러오면 자동으로 전체가 재분류된다.

파일 재업로드 없이도 재분류만 트리거할 수 있도록, **불러오기(`/import`) 화면에 "전체 재분류" 버튼을 추가**한다. 이 버튼은 `importRows([])` (빈 배열)를 호출하는 것과 동등하게 동작 — 신규 거래 0건이어도 기존 로직이 이미 전체 재분류 + upsert를 수행하므로, `importRows`에 별도 분기를 추가할 필요 없이 빈 배열을 넘기는 것만으로 충분하다.

## 4. Supabase 스키마 마이그레이션

`supabase/migrations/0002_drop_saving_flow_type.sql` 신규 작성:

```sql
-- 기존 saving 값을 neutral로 선반영 (재분류 버튼을 누르기 전에도 제약조건이 깨지지 않도록)
update transactions set flow_type = 'neutral' where flow_type = 'saving';
update transactions set flow_type_override = 'neutral' where flow_type_override = 'saving';
update classification_rules set flow_type = 'neutral' where flow_type = 'saving';

alter table transactions drop constraint transactions_flow_type_check;
alter table transactions add constraint transactions_flow_type_check
  check (flow_type in ('income','spending','neutral'));

alter table transactions drop constraint transactions_flow_type_override_check;
alter table transactions add constraint transactions_flow_type_override_check
  check (flow_type_override in ('spending','neutral'));

alter table classification_rules drop constraint classification_rules_flow_type_check;
alter table classification_rules add constraint classification_rules_flow_type_check
  check (flow_type in ('spending','neutral'));
```

(실제 제약조건 이름은 구현 시 `\d transactions`로 확인 후 맞춘다 — Postgres가 자동 생성한 이름일 수 있음.)

이 마이그레이션은 Supabase 대시보드의 SQL Editor에서 사용자가 직접 실행해야 한다 (이 프로젝트는 Supabase CLI가 로컬에 연결되어 있지 않고, 서비스 롤 키도 없어 자동 적용이 불가능함 — `0001_init.sql`도 같은 방식으로 적용된 것으로 보임).

## 5. 거래관리(`/entries`) 화면 변경

### 5.1 탭 축소

`EntrySection`: `income | saving | spending` → **`income | spending`**. `ENTRY_SECTIONS`, `ENTRY_SECTION_LABELS`에서 `saving` 제거. `SEED_SAVING_CATEGORIES`, `savingCategoryOptions` 관련 코드 제거.

### 5.2 "이체로 제외" 오버라이드

두 탭(수입/지출) 모두에 새 액션 버튼을 추가한다: `handleSetOverride(row.id, 'neutral')`. 기존 "저축으로 전환"/"지출로 전환" 버튼은 제거된다 (더 이상 저축 섹션이 없으므로).

### 5.3 제외된 거래 복구

"이체로 제외"한 거래는 `resolvedFlowType`이 `neutral`이 되어 두 탭 어디에도 보이지 않게 된다. 툴바에 **"제외됨 (N)" 필터 토글**을 추가한다 — 켜면 `resolvedFlowType(t) === 'neutral' && t.flowTypeOverride === 'neutral'`인 거래만(자동으로 neutral인 순수 이체·카드대금 등은 제외하고, **사용자가 수동으로 제외한 것만**) 보여주고, 각 행에 "복구" 버튼(`setOverride(id, null)`)을 둔다.

## 6. 영향받지 않는 부분

- `MonthDetailPage`, `monthDetailAggregations.ts`: `resolvedFlowType`을 범용적으로만 쓰고 있어 타입 축소의 영향을 받지 않는다.
- `KpiCards`, `MonthSummaryCard`, `MonthlyTrendChart`: §2.3에서 설명한 대로 인터페이스 변경 없음.
- 이체 페어링(`transferMatching.ts`), 카드대금 처리: 이번 변경과 무관, 그대로 유지.

## 7. 테스트

- `classification.test.ts`: 기존 saving 관련 테스트 케이스들을 neutral 반환 검증으로 수정. 이체+투자 유입 케이스가 이제 income이 아니라 neutral을 반환하는 케이스 추가.
- `aggregations.test.ts`: `summarizeByMonth`의 saving이 residual 공식을 따르는지, 적자 달에 0으로 클램프되는지, netCashFlow가 적자 달엔 음수로 유지되는지 검증.
- `entriesLogic.test.ts`: `ENTRY_SECTIONS`가 2개인지, `filterBySection`이 saving 섹션을 더 이상 인식하지 않는지(타입 레벨에서 이미 컴파일 에러가 나겠지만) 확인.
- `dashboardAggregations.test.ts`: `includeSaving` 매개변수 제거 후 시그니처 테스트 정리.

## 8. 스코프 밖

- **분석(`/analytics`) 탭**은 별도 브레인스토밍/스펙으로 분리한다 (이 변경으로 정리된 저축/지출 모델을 전제로 설계해야 하므로, 이 스펙이 먼저 확정되어야 함).
