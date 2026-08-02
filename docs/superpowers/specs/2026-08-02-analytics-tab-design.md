# 분석(`/analytics`) 탭 설계 문서

## 1. 배경

가계부 앱에 이미 대시보드(월별 트렌드, 카테고리 분해, Top 가맹점, 결제수단 비중, 카테고리×월 히트맵)와 월별 상세(캘린더, 주간 지출 밴드, 지출 페이스, 인포그래픽)가 있다. 이번에 추가하는 "분석" 탭은 이 둘이 다루지 않는 새로운 각도 — 요일/시간대 패턴, 구독 탐지, 카테고리 증감 랭킹, 자동 인사이트, 저축 시뮬레이션/프로젝션 — 을 다룬다.

브레인스토밍에서 15개 아이디어를 제시했고, 사용자가 4개 클러스터(시간 패턴, 구독 탐지, 카테고리 랭킹+인사이트 피드, 저축 시뮬레이터+연간 프로젝션)를 1차로 선택했다. 이상치 탐지/환불율/YoY 비교/소비 성향 뱃지는 이번 스코프에서 제외 (다음 버전 후보).

## 2. 아키텍처

- **`src/lib/analyticsAggregations.ts`** (신규) — 이 탭에 필요한 모든 계산을 담는 순수 함수 모듈. 기존 `src/lib/aggregations.ts`(`resolvedFlowType`, `summarizeByMonth`), `src/lib/dashboardAggregations.ts`(`categoryBreakdown`) 패턴을 그대로 재사용/조합한다. Vitest 유닛테스트 필수 (이 프로젝트의 lib 레이어 TDD 컨벤션).
- **`src/pages/AnalyticsPage.tsx`** (신규) — `/analytics` 라우트. 페이지 컴포저 역할만 하고 계산 로직은 갖지 않는다 (기존 `DashboardPage.tsx`/`MonthDetailPage.tsx`와 동일 패턴).
- **`src/components/analytics/*.tsx`** (신규, 5~6개) — 프레젠테이션 컴포넌트. 이 프로젝트의 기존 컨벤션대로 컴포넌트 레벨 테스트는 없음 (`tsc`/`npm run build`로만 검증).
- 라우팅: `src/App.tsx`에 `/analytics` 라우트 추가, `src/components/AppShell.tsx`의 `navItems`에 "분석" 링크 추가.

## 3. 데이터 함수 상세 (`src/lib/analyticsAggregations.ts`)

### 3.1 `weekdaySpending(transactions: Transaction[]): WeekdayAmount[]`

```ts
export interface WeekdayAmount {
  weekday: string  // '월' | '화' | '수' | '목' | '금' | '토' | '일'
  amount: number   // positive total spending
}
```

전체 기간(필터 없음 — 페이지에서 이미 기간이 좁혀진 transactions를 넘김) 중 `resolvedFlowType(t) === 'spending'`인 거래를 `new Date(t.date).getDay()` 기준으로 월요일 시작 순서(월화수목금토일)로 버킷팅. 각 버킷은 `Math.max(0, -amount)`의 합. 항상 7개 항목을 순서대로 반환 (데이터 없는 요일도 amount: 0으로 포함).

### 3.2 `hourBucketSpending(transactions: Transaction[]): HourBucketAmount[]`

```ts
export type HourBucket = '새벽' | '오전' | '오후' | '저녁' | '심야'
export interface HourBucketAmount {
  bucket: HourBucket
  amount: number
}
```

`t.time`의 시(`HH`)를 파싱해 구간 배정: 00-05→새벽, 06-11→오전, 12-17→오후, 18-21→저녁, 22-23→심야 (경계는 `hour < 6`, `hour < 12`, `hour < 18`, `hour < 22`, 나머지 심야). `resolvedFlowType(t) === 'spending'`만 집계, `Math.max(0, -amount)` 합산. 항상 5개 항목을 이 순서로 반환.

### 3.3 `detectSubscriptions(transactions: Transaction[]): Subscription[]`

```ts
export interface Subscription {
  merchant: string  // t.content
  amount: number     // positive magnitude
  monthCount: number // 이 (merchant, amount) 조합이 관측된 서로 다른 월의 수 (전체 기간 기준)
}
```

알고리즘:
1. `resolvedFlowType(t) === 'spending'`인 거래만 대상.
2. 전체 거래에서 존재하는 월 목록(`t.date.slice(0,7)`)을 오름차순 정렬해 마지막 2개 월(`latestMonth`, `secondLatestMonth`)을 구한다. 월이 2개 미만이면 빈 배열 반환.
3. `(content, Math.abs(amount))`로 그룹핑. 각 그룹에 대해, `latestMonth`와 `secondLatestMonth` 양쪽 모두에 해당 그룹의 거래가 최소 1건씩 존재하면 구독 후보로 채택.
4. 반환값의 `monthCount`는 해당 그룹이 전체 기간 중 몇 개의 서로 다른 월에 나타났는지(2 이상). 금액 내림차순 정렬.

이 정의는 "가장 최근 2개월 연속 반복"만 보므로 이미 해지한 구독은 자동으로 목록에서 빠진다.

### 3.4 `categoryTrendRanking(transactions: Transaction[], month: string): CategoryTrend[]`

```ts
export interface CategoryTrend {
  category: string
  currentAmount: number
  baselineAmount: number  // 직전 3개월 평균
  changeAmount: number    // currentAmount - baselineAmount (양수=증가)
}
```

1. `month`의 직전 3개월(`YYYY-MM` 문자열로 -1, -2, -3개월 계산)에 대해, 각 카테고리별 월 지출 평균(`baselineAmount`)을 구한다. 세 달 중 데이터가 있는 달만으로 평균 낸다 (0건이면 해당 카테고리는 베이스라인 계산에서 제외 — "비교 대상 없음"으로 처리, 인위적으로 0을 섞어 평균을 왜곡하지 않음).
2. `baselineAmount`가 존재하는(즉 직전 3개월 중 최소 1개월 이상 데이터가 있는) 카테고리에 대해서만 `changeAmount` 계산.
3. 반환은 `changeAmount` 내림차순 정렬한 전체 리스트 (UI에서 상위 3 / 하위 3만 뽑아 씀 — 자르는 책임은 UI가 아니라 필요하면 이 함수를 감싸는 얇은 헬퍼에 둘 것; 과설계 방지를 위해 정렬된 전체 리스트만 반환하고 자르기는 컴포넌트가 `.slice()`로 처리).

### 3.5 `generateInsights(transactions, month, monthlySummaries): Insight[]`

```ts
export interface Insight {
  text: string
}
```

`categoryTrendRanking`, `detectSubscriptions`, `hourBucketSpending`, `monthlySummaries`(기존 `summarizeByMonth` 결과)를 조합해 최대 5개의 한국어 문장을 생성. 조건이 성립하지 않으면(데이터 부족 등) 해당 카드는 건너뛴다 — 항상 5개를 채우려 하지 않는다:

1. 카테고리 증가 1위 (changeAmount > 0인 것 중 최대): `"{category} 지출이 최근 3개월 평균보다 {formatKRW(changeAmount)} 늘었어요"`
2. 카테고리 감소 1위 (changeAmount < 0인 것 중 최소): `"{category} 지출이 최근 3개월 평균보다 {formatKRW(-changeAmount)} 줄었어요"`
3. 구독 총액 (`detectSubscriptions` 결과가 1개 이상일 때만): `"이번 달 구독료로 총 {formatKRW(합계)}이 나갔어요 ({count}건)"`
4. 심야 지출 (`hourBucketSpending`의 심야 버킷 amount > 0일 때만): `"심야(22시~24시) 지출이 {formatKRW(amount)}이에요"`
5. 저축률 변동 (`monthlySummaries`에서 이번 달과 전월 모두 존재할 때만): 전월 대비 저축액(`saving`) 증감을 `"이번 달 저축액이 지난달보다 {formatKRW(diff)} {늘었어요|줄었어요}"`

### 3.6 `projectAnnualSaving(monthlySummaries: MonthlySummary[]): number`

직전 3개월(데이터가 3개월 미만이면 있는 만큼)의 `saving` 평균 × 12. 데이터가 0개월이면 0 반환.

### 3.7 `simulateSavings(categoryBaselines: Record<string, number>, reductionByCategory: Record<string, number>): number`

```ts
// reductionByCategory: 카테고리명 → 0~1 사이 절감률 (슬라이더 값)
```

`Σ categoryBaselines[category] * (reductionByCategory[category] ?? 0) * 12`. `categoryBaselines`는 `categoryTrendRanking`이 이미 계산한 직전 3개월 평균(`baselineAmount`)을 카테고리명 키의 맵으로 변환한 것을 재사용 — 새 집계를 만들지 않는다.

## 4. UI 구성 (`AnalyticsPage.tsx`, 위→아래)

1. **인사이트 피드** (`InsightFeed.tsx`) — `generateInsights` 결과를 카드 리스트로. 카드 0개면 "아직 표시할 인사이트가 없어요" 안내.
2. **요일별/시간대별 막대그래프** (`WeekdayChart.tsx`, `HourBucketChart.tsx`) — `sm:flex-row`로 나란히, 기존 `CategoryDonut` 등과 동일한 `rounded-xl bg-white p-6 shadow-sm` 카드 스타일. recharts `BarChart` 재사용 (기존 `MonthlyTrendChart.tsx` 패턴).
3. **카테고리 증감 랭킹** (`CategoryTrendRanking.tsx`) — `categoryTrendRanking` 결과에서 상위 3/하위 3 슬라이스, 두 컬럼(증가/감소)으로 표시.
4. **구독 목록** (`SubscriptionList.tsx`) — 표 형태 (가맹점, 금액, 관측 월 수), 하단에 합계.
5. **저축 시뮬레이터** (`SavingsSimulator.tsx`) — `categoryTrendRanking`에서 뽑은 카테고리별 `baselineAmount`를 기준으로 카테고리당 슬라이더(0~50%, 5% 단위), 상단에 `projectAnnualSaving` 기본값 + 슬라이더 조정분을 더한 "연간 예상 저축액"을 실시간 표시.

기간 선택: 대시보드처럼 최근 6개월/12개월/전체 토글을 페이지 상단에 두고, `weekdaySpending`/`hourBucketSpending`/구독탐지는 이 기간으로 필터된 `transactions`를 받는다. `categoryTrendRanking`/인사이트/시뮬레이터/프로젝션은 "이번 달" 개념이 필요하므로 최신 사용 가능 월(`listAvailableMonths`의 마지막 값)을 고정 기준으로 쓴다 (기간 토글과 무관).

## 5. 테스트

`analyticsAggregations.test.ts` — 함수별 유닛테스트. 경계값 포함: 요일 데이터 없음(0으로 채워진 7개 항목), 시간대 심야 0건, 구독 후보 0건(월 2개 미만/반복 없음), `categoryTrendRanking`에서 직전 3개월 데이터 전혀 없는 카테고리(리스트에서 제외됨), `generateInsights`에서 각 조건 불충족 시 해당 카드 생략, `projectAnnualSaving` 0개월/3개월 미만 케이스, `simulateSavings` 절감률 0/50% 경계.

## 6. 스코프 밖 (다음 버전 후보)

이상 거래 탐지, 환불율 분석, 이번 달 백분위 랭킹, 전년 동월 비교(YoY), 소비 성향 뱃지, 전체 기간 캘린더 히트맵.
