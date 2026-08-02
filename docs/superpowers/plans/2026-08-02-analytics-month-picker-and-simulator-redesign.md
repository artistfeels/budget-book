# 분석 탭 월 선택 + 저축 시뮬레이터 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a month selector to `/analytics` that drives 인사이트 피드/카테고리 증감 랭킹/저축 시뮬레이터 (independent of the existing 6개월/12개월/전체 period toggle), and replace the savings simulator's confusing sliders with labeled percent-reduction buttons showing exact KRW impact.

**Architecture:** Two new pure functions in `src/lib/analyticsAggregations.ts` (extracted/tested logic), a rewritten `SavingsSimulator.tsx`, and a month-selector addition to `AnalyticsPage.tsx`. No new files, no schema changes.

**Tech Stack:** React 18 + TypeScript, Vitest (lib-layer TDD), Tailwind CSS — same stack and conventions as the rest of this project.

## Global Constraints

- Source doc: `docs/superpowers/specs/2026-08-02-analytics-month-picker-and-simulator-redesign.md`.
- Month dropdown styling: reuse the exact pattern from `src/components/entries/EntriesToolbar.tsx`'s month `<select>` (`rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-800`), most-recent-month-first ordering.
- `reductionByCategory` state shape stays `Record<string, number>` with 0-1 fractions (unchanged from the current implementation) — only the UI controlling it changes from a slider to buttons.
- `formatKRW` reused from `src/lib/format.ts` for all money display.
- Git repo: commit directly to `master` after every task (established pattern for this project — no feature branch).
- No component-level tests exist in this codebase; `.tsx` correctness is verified via `tsc`/`npm run build` and manual browser smoke test.

---

### Task 1: `latestMonthWithSpending` + `topSpendingCategories`

**Files:**
- Modify: `src/lib/analyticsAggregations.ts`
- Modify: `src/lib/analyticsAggregations.test.ts`

**Interfaces:**
- Consumes: `Transaction`, `resolvedFlowType` (already imported), `CategoryTrend` (already defined in this file).
- Produces (consumed by Task 3): `latestMonthWithSpending(transactions: Transaction[], availableMonths: string[]): string | undefined`.
- Produces (consumed by Task 2): `topSpendingCategories(trends: CategoryTrend[], limit: number): CategoryTrend[]`.

- [ ] **Step 1: Append the failing tests**

Add `latestMonthWithSpending, topSpendingCategories` to the existing `import { ... } from './analyticsAggregations'` line at the top of the test file, then append:

```ts
describe('latestMonthWithSpending', () => {
  it('returns the latest month that has a spending transaction', () => {
    const txs = [
      tx({ date: '2026-06-10', amount: -10000, flowType: 'spending' }),
      tx({ date: '2026-07-10', amount: -20000, flowType: 'spending' }),
    ]
    expect(latestMonthWithSpending(txs, ['2026-06', '2026-07'])).toBe('2026-07')
  })

  it('falls back to an earlier month when the latest month has no spending', () => {
    const txs = [
      tx({ date: '2026-06-10', amount: -10000, flowType: 'spending' }),
      tx({ date: '2026-07-10', amount: 3000000, flowType: 'income', type: '수입' }),
    ]
    expect(latestMonthWithSpending(txs, ['2026-06', '2026-07'])).toBe('2026-06')
  })

  it('falls back to the plain latest month when no month has any spending', () => {
    const txs = [tx({ date: '2026-07-10', amount: 3000000, flowType: 'income', type: '수입' })]
    expect(latestMonthWithSpending(txs, ['2026-07'])).toBe('2026-07')
  })

  it('returns undefined for an empty months list', () => {
    expect(latestMonthWithSpending([], [])).toBeUndefined()
  })
})

describe('topSpendingCategories', () => {
  it('returns at most `limit` categories, sorted by baselineAmount descending', () => {
    const trends = [
      { category: 'A', currentAmount: 0, baselineAmount: 10000, changeAmount: 0 },
      { category: 'B', currentAmount: 0, baselineAmount: 50000, changeAmount: 0 },
      { category: 'C', currentAmount: 0, baselineAmount: 30000, changeAmount: 0 },
    ]
    expect(topSpendingCategories(trends, 2).map((t) => t.category)).toEqual(['B', 'C'])
  })

  it('excludes categories with a zero baseline', () => {
    const trends = [
      { category: 'A', currentAmount: 0, baselineAmount: 0, changeAmount: 0 },
      { category: 'B', currentAmount: 0, baselineAmount: 10000, changeAmount: 0 },
    ]
    expect(topSpendingCategories(trends, 8).map((t) => t.category)).toEqual(['B'])
  })

  it('returns all qualifying categories when fewer than the limit exist', () => {
    const trends = [{ category: 'A', currentAmount: 0, baselineAmount: 10000, changeAmount: 0 }]
    expect(topSpendingCategories(trends, 8)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/analyticsAggregations.test.ts`
Expected: FAIL — `latestMonthWithSpending`/`topSpendingCategories` are not exported yet.

- [ ] **Step 3: Append the implementation**

Add to the end of `src/lib/analyticsAggregations.ts`:

```ts
export function latestMonthWithSpending(transactions: Transaction[], availableMonths: string[]): string | undefined {
  for (let i = availableMonths.length - 1; i >= 0; i--) {
    const month = availableMonths[i]
    const hasSpending = transactions.some(
      (t) => t.date.slice(0, 7) === month && resolvedFlowType(t) === 'spending'
    )
    if (hasSpending) return month
  }
  return availableMonths[availableMonths.length - 1]
}

export function topSpendingCategories(trends: CategoryTrend[], limit: number): CategoryTrend[] {
  return trends
    .filter((t) => t.baselineAmount > 0)
    .sort((a, b) => b.baselineAmount - a.baselineAmount)
    .slice(0, limit)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/analyticsAggregations.test.ts`
Expected: PASS — all cases green (should be 36 total in this file: 29 existing + 7 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/analyticsAggregations.ts src/lib/analyticsAggregations.test.ts
git commit -m "feat: latestMonthWithSpending and topSpendingCategories helpers for analytics tab"
```

---

### Task 2: Redesign `SavingsSimulator` — buttons instead of sliders

**Files:**
- Modify: `src/components/analytics/SavingsSimulator.tsx`

**Interfaces:**
- Consumes: `categoryTrendRanking`, `projectAnnualSaving`, `simulateSavings`, `topSpendingCategories` (Task 1); `formatKRW`; `MonthlySummary`; `Transaction`.
- Produces (consumed by Task 3, unchanged): `SavingsSimulator` component, same props `{ transactions: Transaction[], month: string, monthlySummaries: MonthlySummary[] }`.

No test file (component code, matches established pattern).

- [ ] **Step 1: Replace the whole file**

```tsx
import { useMemo, useState } from 'react'
import {
  categoryTrendRanking,
  projectAnnualSaving,
  simulateSavings,
  topSpendingCategories,
} from '../../lib/analyticsAggregations'
import { formatKRW } from '../../lib/format'
import type { MonthlySummary } from '../../lib/aggregations'
import type { Transaction } from '../../types/transaction'

interface SavingsSimulatorProps {
  transactions: Transaction[]
  month: string
  monthlySummaries: MonthlySummary[]
}

const REDUCTION_OPTIONS = [0, 10, 20, 30]
const MAX_CATEGORIES = 8

export default function SavingsSimulator({ transactions, month, monthlySummaries }: SavingsSimulatorProps) {
  const trends = useMemo(() => categoryTrendRanking(transactions, month), [transactions, month])
  const topCategories = useMemo(() => topSpendingCategories(trends, MAX_CATEGORIES), [trends])
  const categoryBaselines = useMemo(
    () => Object.fromEntries(topCategories.map((t) => [t.category, t.baselineAmount])),
    [topCategories]
  )
  const [reductionByCategory, setReductionByCategory] = useState<Record<string, number>>({})

  const baseProjection = useMemo(() => projectAnnualSaving(monthlySummaries), [monthlySummaries])
  const extraFromSimulation = useMemo(
    () => simulateSavings(categoryBaselines, reductionByCategory),
    [categoryBaselines, reductionByCategory]
  )

  function setReduction(category: string, percent: number) {
    setReductionByCategory((prev) => ({ ...prev, [category]: percent / 100 }))
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-1 font-medium text-slate-700">저축 시뮬레이터 ({month} 기준)</p>
      <p className="mb-1 text-sm text-slate-500">
        지금 추세면 연간 약 <span className="font-medium text-slate-700">{formatKRW(baseProjection)}</span>을
        저축해요. 아래에서 카테고리 지출을 줄여보면 얼마나 더 모을 수 있는지 확인할 수 있어요.
      </p>
      <p className="mb-4 text-2xl font-bold text-emerald-600">
        {formatKRW(baseProjection + extraFromSimulation)}
        <span className="ml-2 text-sm font-normal text-slate-400">
          연간 예상 저축액{extraFromSimulation > 0 && ` (+${formatKRW(extraFromSimulation)})`}
        </span>
      </p>
      {topCategories.length === 0 ? (
        <p className="text-sm text-slate-400">절감 시뮬레이션에 쓸 카테고리 데이터가 아직 없어요.</p>
      ) : (
        <ul className="space-y-4">
          {topCategories.map((t) => {
            const selected = Math.round((reductionByCategory[t.category] ?? 0) * 100)
            return (
              <li key={t.category}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-slate-700">{t.category}</span>
                  <span className="text-slate-400">{formatKRW(t.baselineAmount)}/월</span>
                </div>
                <div className="flex gap-2">
                  {REDUCTION_OPTIONS.map((percent) => {
                    const isSelected = selected === percent
                    const savedPerMonth = Math.round((t.baselineAmount * percent) / 100)
                    return (
                      <button
                        key={percent}
                        onClick={() => setReduction(t.category, percent)}
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {percent === 0 ? '유지' : `${percent}% (-${formatKRW(savedPerMonth)}/월)`}
                      </button>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

Note what changed from the prior version: the `<input type="range">` per category is replaced with 4 buttons (`REDUCTION_OPTIONS`); the category list now goes through `topSpendingCategories` (capped at `MAX_CATEGORIES`, zero-baseline categories excluded, sorted by spend descending) instead of listing every category `categoryTrendRanking` returned; a new explanatory sentence states the baseline projection before the combined total; the total now shows the simulation's incremental contribution separately (`+${formatKRW(extraFromSimulation)}`) when non-zero. `reductionByCategory`'s shape and `simulateSavings`'s call signature are both unchanged.

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: PASS — no `tsc` errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/analytics/SavingsSimulator.tsx
git commit -m "feat: redesign savings simulator with labeled reduction buttons instead of sliders"
```

---

### Task 3: Month selector on `AnalyticsPage`

**Files:**
- Modify: `src/pages/AnalyticsPage.tsx`

**Interfaces:**
- Consumes: `latestMonthWithSpending` (Task 1); existing `listAvailableMonths`, `summarizeByMonth` (`src/lib/aggregations.ts`); existing `generateInsights` (`src/lib/analyticsAggregations.ts`); existing `InsightFeed`/`CategoryTrendRanking`/`SavingsSimulator` (all now consuming the page-level selected month instead of an auto-computed one).
- Produces: no new exports — page composition only.

No test file (page composition, same rationale as every other `.tsx` file in this project; verified via `tsc` + manual browser smoke test in Step 4).

- [ ] **Step 1: Replace the whole file**

```tsx
import { useMemo, useState } from 'react'
import { useTransactionStore } from '../store/useTransactionStore'
import { listAvailableMonths, summarizeByMonth } from '../lib/aggregations'
import { generateInsights, latestMonthWithSpending } from '../lib/analyticsAggregations'
import InsightFeed from '../components/analytics/InsightFeed'
import WeekdayChart from '../components/analytics/WeekdayChart'
import HourBucketChart from '../components/analytics/HourBucketChart'
import CategoryTrendRanking from '../components/analytics/CategoryTrendRanking'
import SubscriptionList from '../components/analytics/SubscriptionList'
import SavingsSimulator from '../components/analytics/SavingsSimulator'

type Period = 'all' | '6m' | '12m'

export default function AnalyticsPage() {
  const transactions = useTransactionStore((s) => s.transactions)
  const [period, setPeriod] = useState<Period>('12m')

  const availableMonths = useMemo(() => listAvailableMonths(transactions), [transactions])
  // The user's own month choice always wins; `defaultMonth` only fills in before they've picked one
  // (or after the data set changes and no explicit choice has been made yet).
  const defaultMonth = useMemo(
    () => latestMonthWithSpending(transactions, availableMonths),
    [transactions, availableMonths]
  )
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(undefined)
  const month = selectedMonth ?? defaultMonth

  const monthlySummaries = useMemo(() => summarizeByMonth(transactions), [transactions])

  const selectedMonths = useMemo(() => {
    if (period === 'all') return availableMonths
    const count = period === '6m' ? 6 : 12
    return availableMonths.slice(-count)
  }, [availableMonths, period])

  const periodTransactions = useMemo(
    () => transactions.filter((t) => selectedMonths.includes(t.date.slice(0, 7))),
    [transactions, selectedMonths]
  )

  const insights = useMemo(
    () => (month ? generateInsights(transactions, month, monthlySummaries) : []),
    [transactions, month, monthlySummaries]
  )

  if (!month) {
    return (
      <div className="rounded-xl bg-white p-6 text-slate-500 shadow-sm">
        불러온 데이터가 없습니다. 먼저 데이터를 불러와주세요.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">분석</h1>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={month}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-800"
          >
            {[...availableMonths].reverse().map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            {(['6m', '12m', 'all'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
                  period === p ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:text-slate-800'
                }`}
              >
                {p === '6m' ? '최근 6개월' : p === '12m' ? '최근 12개월' : '전체'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <InsightFeed insights={insights} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <WeekdayChart transactions={periodTransactions} />
        <HourBucketChart transactions={periodTransactions} />
      </div>

      <div className="mb-6">
        <CategoryTrendRanking transactions={transactions} month={month} />
      </div>

      <div className="mb-6">
        <SubscriptionList transactions={periodTransactions} />
      </div>

      <div>
        <SavingsSimulator transactions={transactions} month={month} monthlySummaries={monthlySummaries} />
      </div>
    </div>
  )
}
```

Note what changed from the prior version: `latestMonth`'s inline computation is replaced by the imported `latestMonthWithSpending` (Task 1), renamed conceptually to `defaultMonth`; a new `selectedMonth` state plus a `<select>` dropdown let the user override it; `month` (the value actually passed to `InsightFeed`/`CategoryTrendRanking`/`SavingsSimulator`) is `selectedMonth ?? defaultMonth`. `WeekdayChart`/`HourBucketChart`/`SubscriptionList` still receive `periodTransactions` — unaffected by this change, per the design doc.

- [ ] **Step 2: Verify the build and full test suite**

Run: `npm run build`
Expected: PASS — no `tsc` errors.

Run: `npm run test`
Expected: PASS — full suite green (should be around 143 tests: 136 + 7 new from Task 1).

- [ ] **Step 3: Manual browser smoke test**

Run: `npm run dev`, log in, navigate to `/analytics`, and verify by hand:
- A month dropdown appears next to the 6개월/12개월/전체 toggle, defaulting to the latest month with spending.
- Selecting a different (older) month in the dropdown updates 인사이트 피드, 카테고리 증감 랭킹, and 저축 시뮬레이터's header/numbers — but does NOT change 요일별/시간대별 차트 or 구독 목록.
- In 저축 시뮬레이터, each category shows up to 4 percent buttons with a KRW amount printed on each (except "유지"); clicking one highlights it and updates the top "연간 예상 저축액" figure immediately, including the "(+금액)" delta once any category has a non-zero selection.
- No more than 8 categories appear in the simulator, ordered by spend size descending.
- Switching the month dropdown resets any in-progress button selections in the simulator to their default (unselected/"유지") state for the new month's categories (this is expected — `reductionByCategory` state doesn't need to persist across month changes; note in the report if it behaves differently than expected).

Report the outcome (pass/fail per bullet) before considering this complete — note explicitly that browser interaction may not be verifiable in a sandboxed environment without network/OAuth access, matching prior tasks in this project; state clearly what could vs couldn't be observed.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AnalyticsPage.tsx
git commit -m "feat: add month selector to analytics tab, driving insights/ranking/simulator independently of the period toggle"
```

---
