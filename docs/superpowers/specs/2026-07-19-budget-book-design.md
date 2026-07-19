# 가계부 웹앱 — 설계 문서

날짜: 2026-07-19
원본 요구사항: `가계부앱_클로드코드_첫프롬프트.md` (프로젝트 루트)

## 1. 배경 및 원본 스펙과의 차이

원본 스펙은 "로컬 전용, 서버 없음, IndexedDB(Dexie) 저장"을 전제로 했으나, 브레인스토밍 중 사용자가 "집이든 폰이든 어디서든 보고 싶다"는 요구를 추가했다. 이에 따라 저장/배포 아키텍처를 다음과 같이 변경한다. **원본 스펙의 화면 구성, 데이터 처리 규칙(이체 제외, 저축/소비 구분, 페어 매칭 등)은 그대로 유효**하며, 저장소만 IndexedDB → Supabase Postgres로 바뀐다.

- 사용자는 이 프로젝트를 계속 사용할 것이며(1회성 아님), 과거 데이터도 추가로 넣을 예정. 현재 엑셀(`2025-07-19~2026-07-19.xlsx`, 1,668건)은 샘플일 뿐 최종 데이터가 아님.
- Excel 파일은 뱅크샐러드 내보내기 형식으로 반복 제공됨. 컬럼 순서 변경에 안전하도록 **헤더 이름 기반 매핑**으로 파싱한다 (원본 스펙 요구사항, 변경 없음).

## 2. 아키텍처

- **프론트엔드**: React 18 + TypeScript + Vite + Tailwind CSS. Recharts(차트), date-fns(한국어 로케일), SheetJS(xlsx 파싱), Zustand(상태).
- **백엔드**: 별도 서버 코드 없음. **Supabase(Postgres)를 브라우저에서 supabase-js로 직접 호출**. Row Level Security로 `user_id = auth.uid()` 스코핑.
- **인증**: Supabase Auth의 **Google 소셜 로그인**. 로그인한 사용자 본인 데이터만 RLS로 보호.
- **배포**: Vercel. 환경변수 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **상태 관리 패턴**: 앱 시작 시 Supabase에서 해당 사용자의 전체 거래를 한 번 읽어 Zustand 스토어에 적재. 이후 모든 CRUD/오버라이드/import는 "Supabase에 쓰기 → 성공 시 Zustand 갱신"으로 처리 (write-through). 거래량이 개인 가계부 수년치(1만~2만 건) 규모라 전체를 메모리에 캐싱해도 무리 없음. `dexie-react-hooks` 같은 실시간 구독 방식보다 단순함을 우선.
- **오프라인 캐시(IndexedDB)는 이번 스코프에서 제외** — 인터넷 연결을 전제로 하며, 필요해지면 추후 별도 단계로 추가.
- **백업**: JSON export/import 버튼은 유지 (Supabase 데이터를 로컬 JSON으로 내보내기/가져오기).
- **테스트**: Vitest.
- **Git**: 로컬 저장소 초기화 완료, origin = `https://github.com/artistfeels/budget-book.git`.

## 3. 데이터 모델

### 3.1 Supabase 스키마 (`supabase/migrations/0001_init.sql`)

```sql
create table transactions (
  id text primary key,                 -- 결정적 해시 (아래 3.3 참조)
  user_id uuid not null references auth.users(id) default auth.uid(),
  date date not null,
  time time not null,
  type text not null check (type in ('수입','지출','이체')),
  category text not null,              -- 대분류
  subcategory text not null,           -- 소분류 (없으면 '미분류')
  content text not null,               -- 내용
  amount integer not null,             -- 부호 있는 그대로 (엑셀 원본 부호 신뢰, 3.4 참조)
  currency text not null default 'KRW',
  payment_method text not null,
  memo text,
  flow_type text not null check (flow_type in ('income','saving','spending','neutral')),
  flow_type_override text check (flow_type_override in ('saving','spending')),
  transfer_pair_id text,
  is_paired_transfer boolean not null default false,
  is_unmatched_transfer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on transactions (user_id, date);
alter table transactions enable row level security;
create policy "own rows" on transactions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table classification_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  match_type text not null check (match_type in ('content','payment_method')),
  match_value text not null,
  flow_type text not null check (flow_type in ('saving','spending')),
  created_at timestamptz not null default now()
);
alter table classification_rules enable row level security;
create policy "own rows" on classification_rules for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

카테고리/소분류/결제수단은 **별도 테이블을 두지 않는다** — 자유 텍스트 컬럼으로 두고, 드롭다운 목록은 "시드 목록(`src/lib/categories.ts`에 하드코딩) + 현재 데이터의 distinct 값"을 합쳐서 클라이언트에서 구성한다. 이러면 "새 값이 나오면 자동으로 목록에 추가"가 별도 동기화 로직 없이 자연히 충족된다.

거래별 오버라이드(소비성↔저축성 수동 변경)는 `flow_type_override` 컬럼에 직접 저장한다. ID가 안정적 해시라 재import해도 같은 행에 계속 붙는다. **Import 시 upsert는 원본 필드만 갱신하고 `flow_type_override`, `transfer_pair_id`, `is_paired_transfer`는 덮어쓰지 않는다** (기존 값 우선, 재계산은 별도 매칭 단계에서).

### 3.2 TypeScript 타입 (`src/types/transaction.ts`)

```ts
export type TransactionType = '수입' | '지출' | '이체'
export type FlowType = 'income' | 'saving' | 'spending' | 'neutral'

export interface Transaction {
  id: string
  date: string        // YYYY-MM-DD
  time: string         // HH:MM:SS
  type: TransactionType
  category: string
  subcategory: string
  content: string
  amount: number        // signed
  currency: 'KRW'
  paymentMethod: string
  memo: string | null
  flowType: FlowType             // 규칙으로 계산된 값
  flowTypeOverride: 'saving' | 'spending' | null  // 수동 오버라이드 (있으면 flowType보다 우선)
  transferPairId: string | null
  isPairedTransfer: boolean
  isUnmatchedTransfer: boolean
}

export interface ClassificationRule {
  id: string
  matchType: 'content' | 'payment_method'
  matchValue: string
  flowType: 'saving' | 'spending'
}
```

### 3.3 거래 ID (결정적 해시)

`id = sha256(date|time|type|category|subcategory|content|amount|paymentMethod)` (16진 앞 32자 등으로 축약). 같은 파일을 여러 번 재import해도 항상 같은 ID가 나와 자연스럽게 upsert/dedup의 키가 된다. 완전히 동일한 행(같은 초에 같은 가게, 같은 금액)이 우연히 중복되는 경우는 사실상 무시 가능한 리스크로 간주.

### 3.4 금액 부호 처리 (환불/취소 예외 대응)

실제 데이터 검증 결과 `타입=지출`인데 금액이 양수인 행이 11건 존재 (부분 취소/환불로 추정). **타입으로 부호를 강제하지 않고 엑셀에 이미 들어있는 부호를 그대로 신뢰**한다 — 이러면 환불 건이 해당 카테고리 지출 합계에서 자동으로 상계(net)된다. 다만 자동 상계가 이상해 보이는 경우(예: 같은 달에 상쇄되는 원거래를 못 찾는 등)를 위해, **금액 부호와 타입이 어긋나는 행은 import 결과 화면에 "부호 확인 필요" 경고 뱃지로 표시**해 사용자가 검토/수정할 수 있게 한다. 자동 처리를 막지는 않는다.

### 3.5 이체 제외 및 카드대금 처리

- `이체` 타입은 수입/지출 집계에서 제외 (neutral).
- **카드대금**(`이체 > 카드대금`)은 페어링 대상이 아니며 **항상 neutral로 집계에서 완전히 제외**한다. 실제 소비는 카드 사용 시점(`지출`)에 이미 잡혀 있고, 카드대금은 결제 계좌에서 카드사로 돈이 빠져나가는 시점만 다른 것뿐 — 반대쪽 다리를 찾아 페어링할 필요 없음.

### 3.6 내계좌이체 페어 매칭

- 대상: `타입 == 이체 && 대분류 == 내계좌이체`
- 매칭 조건: `abs(금액)` 같음 + 부호 반대 + 결제수단 다름 + 시각 차이 ±3분 이내
- 후보 다중 시 시간 차이가 가장 가까운 쌍부터 그리디 1:1 매칭 (이미 매칭된 행 재사용 금지)
- 매칭 성공 → 양쪽에 같은 `transferPairId` 부여, `isPairedTransfer = true`
- 매칭 실패 → `isUnmatchedTransfer = true`, import 결과 화면과 이체 탭에 경고 뱃지로 노출 (조용히 버리지 않음)
- 이 매칭은 **매 import 후 해당 사용자의 전체 내계좌이체 행 집합(기존 + 신규)을 대상으로 재계산**한다 — 기간이 겹치는 파일을 여러 번 넣거나, 페어의 한쪽 다리만 먼저 들어오는 경우에도 이후 재계산 시 잡히도록.
- 실제 데이터로 시뮬레이션 검증 완료: 140건 중 136건(68쌍) 정상 매칭, 4건 미매칭 → 스펙대로 동작 확인.
- 유닛 테스트 필수 (정상 페어 / 3분 초과 / 금액만 같고 같은 계좌 / 후보 다중 / 짝 없음)

### 3.7 저축성(saving) vs 소비성(spending) vs 수입(income) 판정 — `src/lib/classification.ts`

우선순위 순으로 평가 (첫 매칭 규칙 적용). **사용자 오버라이드/규칙이 항상 자동 판정보다 먼저 적용**된다:

1. 거래별 수동 오버라이드(`flowTypeOverride`)가 설정돼 있으면 → 그 값 그대로 사용 (아래 규칙 전부 스킵)
2. 사용자 정의 규칙(`classification_rules`: 특정 가맹점/결제수단 → saving/spending 고정)에 매칭되면 → 그 값
3. **결제수단**이 `주택청약종합저축` / `NH청년도약계좌` / `월세 보증금`인 유출 → `saving`
4. `타입 == 이체 && 대분류 == 투자`:
   - 금액 < 0 (출금/투자 넣는 방향) → `saving`
   - 금액 > 0 (투자금 회수/입금 방향) → **`income`** (사용자 확인: 회수된 돈은 소비가 아니라 소득이므로 소득 섹션에 반영)
5. `타입 == 지출 && 대분류 == 금융 && 소분류 == 증권/투자` → `saving`
6. `타입 == 이체 && 대분류 == 카드대금` → `neutral` (3.5)
7. `타입 == 이체` 이고 위에 해당 안 되며 페어 매칭된 내계좌이체(`isPairedTransfer`) → `neutral`
8. `타입 == 이체` 이고 미매칭(`isUnmatchedTransfer`) → `neutral` (집계 제외, 단 UI에서 경고로 노출)
9. 그 외 `타입 == 이체` 전부 (예: 대분류 `현금`, `이체`(미분류) 등 페어링 대상이 아닌 이체) → `neutral` — 이체는 어떤 대분류든 예외 없이 수입/지출 집계에서 제외
10. `타입 == 수입` → `income`
11. 그 외 `타입 == 지출` → `spending`

KPI 재정의 (원본 스펙 유지):
- 총수입 = `income` 합계, 소비지출 = `spending` 합계, 저축·투자 = `saving` 합계
- 실질 저축률 = (수입 − 소비지출) / 수입, 순현금흐름 = 수입 − 소비지출 − 저축

### 3.8 화면 구성, 디자인 규칙, 분류 체계 시드값

원본 스펙(`가계부앱_클로드코드_첫프롬프트.md`) 129~192행 "화면 구성"과 "디자인" 섹션, 101~127행의 분류 체계/결제수단 시드 목록을 그대로 따른다 (변경 없음). 이 설계 문서에서 반복 기술하지 않음.

## 4. 구현 순서 (원본 스펙 "진행 방식" 기준)

1. 프로젝트 스캐폴딩 (Vite+React+TS+Tailwind), Supabase 프로젝트 연결, Google 로그인
2. 데이터 레이어: 타입 정의 → `idHash` → `excelParser` (헤더 매핑) → `classification.ts` → `transferMatching.ts` (+ 유닛 테스트) → `aggregations.ts` (+ 유닛 테스트) → Supabase 스키마/RLS 적용 → Zustand 스토어
3. 대시보드
4. 월별 상세
5. 거래 입력/관리
6. 데이터 불러오기(import) 화면
7. Vercel 배포, README 정리

## 5. 스코프에서 제외

- 다크모드
- 오프라인(IndexedDB) 캐시 — 필요 시 추후 별도 단계
- 멀티유저/공유 (Google 로그인은 "내 계정만 접근" 용도일 뿐, 여러 사용자 지원 아님)
