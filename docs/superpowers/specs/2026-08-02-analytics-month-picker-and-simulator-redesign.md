# 분석 탭 월 선택 + 저축 시뮬레이터 재설계

## 1. 배경

`/analytics` 탭 출시 후 사용자 피드백 2건:

1. 카테고리 증감 랭킹/저축 시뮬레이터/인사이트 피드가 "지출이 있는 가장 최근 달"에 고정되어 있어, 과거 달을 살펴볼 방법이 없다.
2. 저축 시뮬레이터가 "슬라이더가 뭘 조작하는 건지, 금액이 뭘 뜻하는지 전체적으로 이해가 안 됨" — UI가 목적을 전달하지 못함.

## 2. 월 선택

`AnalyticsPage`에 월 선택 드롭다운을 추가한다 (`EntriesPage`의 월 선택과 동일하게 최근 월이 위로 오는 내림차순). 이 선택값(`selectedMonth`)은 기존 6개월/12개월/전체 기간 토글과 **별개**로 동작하며, 다음 3개 카드에 전달된다:

- `InsightFeed` (내부적으로 `generateInsights(transactions, selectedMonth, monthlySummaries)`)
- `CategoryTrendRanking` (`month={selectedMonth}`)
- `SavingsSimulator` (`month={selectedMonth}`)

기간 토글의 영향을 받는 3개 카드(`WeekdayChart`, `HourBucketChart`, `SubscriptionList`)는 변경 없음.

기본값: 기존에 `AnalyticsPage.tsx`에 인라인으로 있던 "지출이 있는 가장 최근 달" 계산 로직을 `src/lib/analyticsAggregations.ts`의 새 함수 `latestMonthWithSpending(transactions, availableMonths)`로 추출한다 (지금까지 이 로직에 실제 버그가 한 번 있었던 만큼, 유닛테스트로 고정해 둘 가치가 있음). `selectedMonth`의 초기값으로 사용.

## 3. 저축 시뮬레이터 재설계

### 3.1 슬라이더 → 절감률 버튼 칩

기존 `<input type="range">`를 카테고리당 4개의 버튼(0%/10%/20%/30%)으로 교체한다. 각 버튼에는 클릭하기 전부터 실제 절감액이 찍혀 있다: `"10% (-15,000원/월)"`. 클릭한 버튼이 선택 상태로 강조 표시된다. 내부 상태(`reductionByCategory: Record<string, number>`, 0~1 fraction)는 변경 없이 유지 — UI만 슬라이더에서 버튼으로 바뀐다.

### 3.2 카테고리 목록 정리

전체 `categoryBaselines`를 다 나열하지 않고, `baselineAmount > 0`인 것만 **지출 금액이 큰 순으로 최대 8개**까지만 보여준다. 이를 위해 `src/lib/analyticsAggregations.ts`에 새 함수 `topSpendingCategories(trends: CategoryTrend[], limit: number): CategoryTrend[]`를 추가한다 (`baselineAmount` 내림차순 정렬 + 0 초과 필터 + `slice(0, limit)`).

### 3.3 헤더에 기준선 설명 추가

상단에 "지금 추세면 연간 약 OOO원 저축돼요" 같은 기준선 설명을 명확히 하고, 카테고리를 절감했을 때 "+OOO원 더 모을 수 있어요"처럼 기준선과 절감분을 구분해서 보여준다 (기존엔 합산된 숫자 하나만 보여서 어디까지가 "원래" 저축이고 어디부터가 "시뮬레이션 효과"인지 안 보였음).

## 4. 테스트

- `latestMonthWithSpending`: 지출이 섞인 데이터, 최신 달이 수입/이체만 있는 경우, 지출이 하나도 없는 경우(→ undefined), 빈 배열.
- `topSpendingCategories`: 8개 초과 케이스에서 정확히 8개만, `baselineAmount === 0`인 카테고리 제외, `baselineAmount` 내림차순 정렬 확인.

## 5. 스코프 밖

인사이트 피드 자체의 문구/로직 변경 없음 (이미 `month` 파라미터를 받도록 되어 있어 그대로 전달만 하면 됨). 기간 토글 3개 카드는 이번 변경과 무관.
