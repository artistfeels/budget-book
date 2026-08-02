# 분석(`/analytics`) 탭 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new "분석" tab (`/analytics`) covering weekday/time-of-day spending patterns, subscription detection, category trend ranking, an auto-generated insight feed, and a savings goal simulator + annual projection — all computed from data already in the store, with no new schema.

**Architecture:** All calculation logic lives in a new pure module `src/lib/analyticsAggregations.ts` (Vitest TDD, following the exact patterns already established in `src/lib/aggregations.ts` and `src/lib/dashboardAggregations.ts`). A new page `src/pages/AnalyticsPage.tsx` composes 6 new presentational components under `src/components/analytics/`. No store changes, no new routes' worth of data fetching — everything reads from the existing `useTransactionStore`.

**Tech Stack:** React 18 + TypeScript, react-router-dom v6, Zustand (existing store, read-only usage), Tailwind CSS, Recharts (existing dependency, same `BarChart`/`ResponsiveContainer` patterns as `src/components/dashboard/MonthlyTrendChart.tsx` and `TopMerchants.tsx`), Vitest (lib-layer TDD only — this codebase has no component-level tests; UI correctness is verified via `tsc`/`npm run build` and manual browser smoke test, matching the established pattern for every existing `.tsx` file in this project).

## Global Constraints

- Source doc: `docs/superpowers/specs/2026-08-02-analytics-tab-design.md` — read for full rationale; this plan implements it exactly.
- Colors (already established, reuse exactly): 수입 = `text-blue-600` / `#2563eb`, 지출 = `text-rose-600` / `#e11d48`, 저축 = `text-emerald-600` / `#059669`. Card style: `rounded-xl bg-white p-6 shadow-sm` (every dashboard/month-detail card uses this — match it exactly). Active period-toggle button: `bg-blue-600 text-white` (see `DashboardPage.tsx`'s period buttons).
- Currency formatting: reuse `formatKRW`/`formatManwon` from `src/lib/format.ts`. Do not create a new formatter.
- Month keys are `YYYY-MM` strings everywhere (`transaction.date.slice(0, 7)`), matching every other lib file.
- All new aggregation functions filter to `resolvedFlowType(t) === 'spending'` (imported from `src/lib/aggregations.ts`) unless stated otherwise — never compare `t.flowType` directly (an override must always be respected).
- `MonthlySummary` (from `src/lib/aggregations.ts`, already has `saving = max(0, income - spending)` per month, per the flow-classification-simplification work already shipped) is the source of truth for savings figures — do not recompute savings a different way in this plan.
- Git repo: commit directly to `master` after every task (established pattern for this project — no feature branch).
- This plan builds ONE file (`src/lib/analyticsAggregations.ts`) incrementally across Tasks 1–4 — each task APPENDS new exports to the file created in Task 1. Follow the exact insertion points given in each task; do not reorder or restructure what a prior task already added.

---

### Task 1: `weekdaySpending` + `hourBucketSpending` (`src/lib/analyticsAggregations.ts`)

**Files:**
- Create: `src/lib/analyticsAggregations.ts`
- Create: `src/lib/analyticsAggregations.test.ts`

**Interfaces:**
- Consumes: `Transaction` (`src/types/transaction.ts`), `resolvedFlowType` (`src/lib/aggregations.ts`).
- Produces (consumed by Task 5): `WeekdayAmount` type, `weekdaySpending(transactions: Transaction[]): WeekdayAmount[]`, `HourBucket` type, `HourBucketAmount` type, `hourBucketSpending(transactions: Transaction[]): HourBucketAmount[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/analyticsAggregations.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { weekdaySpending, hourBucketSpending } from './analyticsAggregations'
import type { Transaction } from '../types/transaction'

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'id',
    date: '2026-07-06', // Monday
    time: '12:00:00',
    type: '지출',
    category: '식비',
    subcategory: '배달',
    content: '테스트',
    amount: -1000,
    currency: 'KRW',
    paymentMethod: '삼성카드 taptap O',
    memo: null,
    flowType: 'spending',
    flowTypeOverride: null,
    transferPairId: null,
    isPairedTransfer: false,
    isUnmatchedTransfer: false,
    ...overrides,
  }
}

describe('weekdaySpending', () => {
  it('buckets spending by weekday, Monday first', () => {
    const txs = [
      tx({ date: '2026-07-06', amount: -10000 }), // Mon
      tx({ date: '2026-07-07', amount: -5000 }), // Tue
      tx({ date: '2026-07-12', amount: -3000 }), // Sun
    ]
    const result = weekdaySpending(txs)
    expect(result).toEqual([
      { weekday: '월', amount: 10000 },
      { weekday: '화', amount: 5000 },
      { weekday: '수', amount: 0 },
      { weekday: '목', amount: 0 },
      { weekday: '금', amount: 0 },
      { weekday: '토', amount: 0 },
      { weekday: '일', amount: 3000 },
    ])
  })

  it('excludes non-spending flow types', () => {
    const txs = [tx({ date: '2026-07-06', amount: 3000000, flowType: 'income', type: '수입' })]
    expect(weekdaySpending(txs).every((w) => w.amount === 0)).toBe(true)
  })

  it('nets refunds against the same weekday and clamps at 0', () => {
    const txs = [
      tx({ date: '2026-07-06', amount: -10000 }),
      tx({ date: '2026-07-06', amount: 15000 }), // over-refund, same Monday
    ]
    const result = weekdaySpending(txs)
    expect(result.find((w) => w.weekday === '월')?.amount).toBe(0)
  })

  it('returns all 7 weekdays with 0 for an empty dataset', () => {
    expect(weekdaySpending([])).toHaveLength(7)
    expect(weekdaySpending([]).every((w) => w.amount === 0)).toBe(true)
  })
})

describe('hourBucketSpending', () => {
  it('buckets spending into 새벽/오전/오후/저녁/심야 by hour', () => {
    const txs = [
      tx({ time: '03:00:00', amount: -1000 }), // 새벽
      tx({ time: '09:00:00', amount: -2000 }), // 오전
      tx({ time: '15:00:00', amount: -3000 }), // 오후
      tx({ time: '19:00:00', amount: -4000 }), // 저녁
      tx({ time: '23:30:00', amount: -5000 }), // 심야
    ]
    expect(hourBucketSpending(txs)).toEqual([
      { bucket: '새벽', amount: 1000 },
      { bucket: '오전', amount: 2000 },
      { bucket: '오후', amount: 3000 },
      { bucket: '저녁', amount: 4000 },
      { bucket: '심야', amount: 5000 },
    ])
  })

  it('treats hour boundaries correctly (06:00 is 오전, not 새벽; 22:00 is 심야, not 저녁)', () => {
    const txs = [
      tx({ time: '06:00:00', amount: -1000 }),
      tx({ time: '22:00:00', amount: -2000 }),
    ]
    const result = hourBucketSpending(txs)
    expect(result.find((h) => h.bucket === '오전')?.amount).toBe(1000)
    expect(result.find((h) => h.bucket === '새벽')?.amount).toBe(0)
    expect(result.find((h) => h.bucket === '심야')?.amount).toBe(2000)
    expect(result.find((h) => h.bucket === '저녁')?.amount).toBe(0)
  })

  it('returns all 5 buckets with 0 for an empty dataset', () => {
    expect(hourBucketSpending([])).toHaveLength(5)
    expect(hourBucketSpending([]).every((h) => h.amount === 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/analyticsAggregations.test.ts`
Expected: FAIL — `src/lib/analyticsAggregations.ts` does not exist yet.

- [ ] **Step 3: Implement `src/lib/analyticsAggregations.ts`**

```ts
import type { Transaction } from '../types/transaction'
import { resolvedFlowType } from './aggregations'

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

// JS Date#getDay(): 0=Sun..6=Sat. Convert to a Monday-first index (0=Mon..6=Sun),
// matching the Monday-start convention already used for weekly spending bands elsewhere in this app.
function mondayFirstIndex(jsDay: number): number {
  return (jsDay + 6) % 7
}

export interface WeekdayAmount {
  weekday: string
  amount: number
}

export function weekdaySpending(transactions: Transaction[]): WeekdayAmount[] {
  const totals = new Array(7).fill(0)
  for (const t of transactions) {
    if (resolvedFlowType(t) !== 'spending') continue
    const [y, m, d] = t.date.split('-').map(Number)
    const jsDay = new Date(y, m - 1, d).getDay()
    totals[mondayFirstIndex(jsDay)] += t.amount
  }
  return WEEKDAY_LABELS.map((weekday, i) => ({ weekday, amount: Math.max(0, -totals[i]) }))
}

export type HourBucket = '새벽' | '오전' | '오후' | '저녁' | '심야'

const HOUR_BUCKETS: HourBucket[] = ['새벽', '오전', '오후', '저녁', '심야']

function hourBucketIndex(hour: number): number {
  if (hour < 6) return 0
  if (hour < 12) return 1
  if (hour < 18) return 2
  if (hour < 22) return 3
  return 4
}

export interface HourBucketAmount {
  bucket: HourBucket
  amount: number
}

export function hourBucketSpending(transactions: Transaction[]): HourBucketAmount[] {
  const totals = new Array(5).fill(0)
  for (const t of transactions) {
    if (resolvedFlowType(t) !== 'spending') continue
    const hour = Number(t.time.slice(0, 2))
    totals[hourBucketIndex(hour)] += t.amount
  }
  return HOUR_BUCKETS.map((bucket, i) => ({ bucket, amount: Math.max(0, -totals[i]) }))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/analyticsAggregations.test.ts`
Expected: PASS — all 8 cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analyticsAggregations.ts src/lib/analyticsAggregations.test.ts
git commit -m "feat: weekday and hour-of-day spending breakdowns for the analytics tab"
```

---

### Task 2: `detectSubscriptions`

**Files:**
- Modify: `src/lib/analyticsAggregations.ts`
- Modify: `src/lib/analyticsAggregations.test.ts`

**Interfaces:**
- Consumes: `Transaction`, `resolvedFlowType` (already imported in Task 1).
- Produces (consumed by Task 4, Task 7): `Subscription` type, `detectSubscriptions(transactions: Transaction[]): Subscription[]`.

- [ ] **Step 1: Append the failing tests**

Add to the end of `src/lib/analyticsAggregations.test.ts`:

```ts
import { detectSubscriptions } from './analyticsAggregations'
```

(Add `detectSubscriptions` to the existing import line from `./analyticsAggregations` at the top of the file — do not add a second `import` statement.)

```ts
describe('detectSubscriptions', () => {
  it('detects a recurring merchant+amount pair present in the latest two months', () => {
    const txs = [
      tx({ date: '2026-06-01', content: '넷플릭스', amount: -17000 }),
      tx({ date: '2026-07-01', content: '넷플릭스', amount: -17000 }),
    ]
    expect(detectSubscriptions(txs)).toEqual([{ merchant: '넷플릭스', amount: 17000, monthCount: 2 }])
  })

  it('counts every distinct month the pair appears in, not just the latest two', () => {
    const txs = [
      tx({ date: '2026-05-01', content: '넷플릭스', amount: -17000 }),
      tx({ date: '2026-06-01', content: '넷플릭스', amount: -17000 }),
      tx({ date: '2026-07-01', content: '넷플릭스', amount: -17000 }),
    ]
    expect(detectSubscriptions(txs)).toEqual([{ merchant: '넷플릭스', amount: 17000, monthCount: 3 }])
  })

  it('excludes a one-off purchase that only appears in the latest month', () => {
    const txs = [
      tx({ date: '2026-06-01', content: '넷플릭스', amount: -17000 }),
      tx({ date: '2026-07-01', content: '넷플릭스', amount: -17000 }),
      tx({ date: '2026-07-15', content: '가전제품', amount: -500000 }),
    ]
    expect(detectSubscriptions(txs)).toEqual([{ merchant: '넷플릭스', amount: 17000, monthCount: 2 }])
  })

  it('excludes a lapsed subscription that stopped before the latest month', () => {
    const txs = [
      tx({ date: '2026-05-01', content: '왓챠', amount: -12900 }),
      tx({ date: '2026-06-01', content: '왓챠', amount: -12900 }),
      tx({ date: '2026-07-01', content: '넷플릭스', amount: -17000 }), // unrelated tx to establish July as latest
    ]
    expect(detectSubscriptions(txs)).toEqual([])
  })

  it('returns an empty array when fewer than 2 distinct months of data exist', () => {
    const txs = [tx({ date: '2026-07-01', content: '넷플릭스', amount: -17000 })]
    expect(detectSubscriptions(txs)).toEqual([])
  })

  it('treats a different amount at the same merchant as a different subscription candidate', () => {
    const txs = [
      tx({ date: '2026-06-01', content: '통신비', amount: -50000 }),
      tx({ date: '2026-07-01', content: '통신비', amount: -55000 }), // price changed — no 2-month match either way
    ]
    expect(detectSubscriptions(txs)).toEqual([])
  })

  it('sorts multiple detected subscriptions by amount descending', () => {
    const txs = [
      tx({ date: '2026-06-01', content: '유튜브 프리미엄', amount: -14900 }),
      tx({ date: '2026-07-01', content: '유튜브 프리미엄', amount: -14900 }),
      tx({ date: '2026-06-01', content: '넷플릭스', amount: -17000 }),
      tx({ date: '2026-07-01', content: '넷플릭스', amount: -17000 }),
    ]
    expect(detectSubscriptions(txs).map((s) => s.merchant)).toEqual(['넷플릭스', '유튜브 프리미엄'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/analyticsAggregations.test.ts`
Expected: FAIL — `detectSubscriptions` is not exported yet.

- [ ] **Step 3: Append the implementation**

Add to the end of `src/lib/analyticsAggregations.ts`:

```ts
export interface Subscription {
  merchant: string
  amount: number
  monthCount: number
}

export function detectSubscriptions(transactions: Transaction[]): Subscription[] {
  const spendingTx = transactions.filter((t) => resolvedFlowType(t) === 'spending')
  const months = [...new Set(spendingTx.map((t) => t.date.slice(0, 7)))].sort()
  if (months.length < 2) return []
  const latestMonth = months[months.length - 1]
  const secondLatestMonth = months[months.length - 2]

  const groups = new Map<string, { merchant: string; amount: number; months: Set<string> }>()
  for (const t of spendingTx) {
    const amount = Math.abs(t.amount)
    const key = `${t.content}::${amount}`
    const group = groups.get(key) ?? { merchant: t.content, amount, months: new Set<string>() }
    group.months.add(t.date.slice(0, 7))
    groups.set(key, group)
  }

  return [...groups.values()]
    .filter((g) => g.months.has(latestMonth) && g.months.has(secondLatestMonth))
    .map((g) => ({ merchant: g.merchant, amount: g.amount, monthCount: g.months.size }))
    .sort((a, b) => b.amount - a.amount)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/analyticsAggregations.test.ts`
Expected: PASS — all Task 1 + Task 2 cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analyticsAggregations.ts src/lib/analyticsAggregations.test.ts
git commit -m "feat: subscription/recurring-payment detection for the analytics tab"
```

---

### Task 3: `categoryTrendRanking`

**Files:**
- Modify: `src/lib/analyticsAggregations.ts`
- Modify: `src/lib/analyticsAggregations.test.ts`

**Interfaces:**
- Consumes: `Transaction`, `resolvedFlowType` (already imported).
- Produces (consumed by Task 4, Task 6, Task 7): `CategoryTrend` type, `categoryTrendRanking(transactions: Transaction[], month: string): CategoryTrend[]`, and an internal (NOT exported) `shiftMonth(month: string, delta: number): string` helper that Task 4 will also call directly (same file, so no export needed — this mirrors the existing unexported `shiftMonth` helper in `src/lib/monthDetailAggregations.ts:88-92`, same exact implementation).

- [ ] **Step 1: Append the failing tests**

Add `categoryTrendRanking` to the existing `import { ... } from './analyticsAggregations'` line at the top of the test file, then append:

```ts
describe('categoryTrendRanking', () => {
  it('computes changeAmount against the average of prior months that actually have data', () => {
    const txs = [
      tx({ date: '2026-07-10', category: '식비', amount: -50000 }),
      tx({ date: '2026-06-10', category: '식비', amount: -30000 }),
      tx({ date: '2026-05-10', category: '식비', amount: -40000 }),
      // no 식비 data in 2026-04 — average should be over the 2 months that exist, not 3
    ]
    const result = categoryTrendRanking(txs, '2026-07')
    expect(result).toEqual([{ category: '식비', currentAmount: 50000, baselineAmount: 35000, changeAmount: 15000 }])
  })

  it('excludes a category with no data at all in the 3 prior months', () => {
    const txs = [tx({ date: '2026-07-10', category: '신규카테고리', amount: -10000 })]
    expect(categoryTrendRanking(txs, '2026-07')).toEqual([])
  })

  it('includes a category with baseline data even if the current month has none (changeAmount negative)', () => {
    const txs = [tx({ date: '2026-06-10', category: '여행/숙박', amount: -300000 })]
    const result = categoryTrendRanking(txs, '2026-07')
    expect(result).toEqual([
      { category: '여행/숙박', currentAmount: 0, baselineAmount: 300000, changeAmount: -300000 },
    ])
  })

  it('sorts by changeAmount descending (biggest increase first, biggest decrease last)', () => {
    const txs = [
      tx({ date: '2026-07-10', category: '교통', amount: -20000 }),
      tx({ date: '2026-06-10', category: '교통', amount: -10000 }), // +10000
      tx({ date: '2026-07-10', category: '문화/여가', amount: -5000 }),
      tx({ date: '2026-06-10', category: '문화/여가', amount: -50000 }), // -45000
    ]
    const result = categoryTrendRanking(txs, '2026-07')
    expect(result.map((r) => r.category)).toEqual(['교통', '문화/여가'])
  })

  it('excludes non-spending flow types from both current and baseline calculations', () => {
    const txs = [
      tx({ date: '2026-07-10', category: '급여', amount: 3000000, flowType: 'income', type: '수입' }),
      tx({ date: '2026-06-10', category: '급여', amount: 3000000, flowType: 'income', type: '수입' }),
    ]
    expect(categoryTrendRanking(txs, '2026-07')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/analyticsAggregations.test.ts`
Expected: FAIL — `categoryTrendRanking` is not exported yet.

- [ ] **Step 3: Append the implementation**

Add to the end of `src/lib/analyticsAggregations.ts`:

```ts
// month-offset helper — same exact pattern as the unexported `shiftMonth` in monthDetailAggregations.ts.
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export interface CategoryTrend {
  category: string
  currentAmount: number
  baselineAmount: number
  changeAmount: number
}

export function categoryTrendRanking(transactions: Transaction[], month: string): CategoryTrend[] {
  const baselineMonths = [shiftMonth(month, -1), shiftMonth(month, -2), shiftMonth(month, -3)]

  const currentByCategory = new Map<string, number>()
  for (const t of transactions) {
    if (resolvedFlowType(t) !== 'spending' || t.date.slice(0, 7) !== month) continue
    currentByCategory.set(t.category, (currentByCategory.get(t.category) ?? 0) + t.amount)
  }

  // category -> baseline month -> signed total, so the average only spans months that actually have data.
  const baselineByCategory = new Map<string, Map<string, number>>()
  for (const t of transactions) {
    if (resolvedFlowType(t) !== 'spending') continue
    const tMonth = t.date.slice(0, 7)
    if (!baselineMonths.includes(tMonth)) continue
    if (!baselineByCategory.has(t.category)) baselineByCategory.set(t.category, new Map())
    const perMonth = baselineByCategory.get(t.category)!
    perMonth.set(tMonth, (perMonth.get(tMonth) ?? 0) + t.amount)
  }

  const categories = new Set([...currentByCategory.keys(), ...baselineByCategory.keys()])
  const result: CategoryTrend[] = []
  for (const category of categories) {
    const perMonth = baselineByCategory.get(category)
    if (!perMonth || perMonth.size === 0) continue // no comparison data at all — skip, per design
    const signedSum = [...perMonth.values()].reduce((sum, v) => sum + v, 0)
    const baselineAmount = Math.max(0, -signedSum / perMonth.size)
    const currentAmount = Math.max(0, -(currentByCategory.get(category) ?? 0))
    result.push({ category, currentAmount, baselineAmount, changeAmount: currentAmount - baselineAmount })
  }
  return result.sort((a, b) => b.changeAmount - a.changeAmount)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/analyticsAggregations.test.ts`
Expected: PASS — all Task 1-3 cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analyticsAggregations.ts src/lib/analyticsAggregations.test.ts
git commit -m "feat: category spending trend ranking vs trailing 3-month average"
```

---

### Task 4: `generateInsights` + `projectAnnualSaving` + `simulateSavings`

**Files:**
- Modify: `src/lib/analyticsAggregations.ts`
- Modify: `src/lib/analyticsAggregations.test.ts`

**Interfaces:**
- Consumes: `Transaction`, `resolvedFlowType`, `categoryTrendRanking`, `shiftMonth` (unexported, same file), `hourBucketSpending`, `detectSubscriptions` (all already in this file); `MonthlySummary` (`src/lib/aggregations.ts`, NEW import needed); `formatKRW` (`src/lib/format.ts`, NEW import needed).
- Produces (consumed by Task 6, Task 8): `Insight` type, `generateInsights(transactions: Transaction[], month: string, monthlySummaries: MonthlySummary[]): Insight[]`.
- Produces (consumed by Task 7, Task 8): `projectAnnualSaving(monthlySummaries: MonthlySummary[]): number`.
- Produces (consumed by Task 7): `simulateSavings(categoryBaselines: Record<string, number>, reductionByCategory: Record<string, number>): number`.

- [ ] **Step 1: Update the import block and append the failing tests**

At the top of `src/lib/analyticsAggregations.test.ts`, add a new import line right after the existing `import type { Transaction } ...` line:

```ts
import type { MonthlySummary } from './aggregations'
```

Add `generateInsights, projectAnnualSaving, simulateSavings` to the existing `import { ... } from './analyticsAggregations'` line.

Append to the end of the file:

```ts
function summary(overrides: Partial<MonthlySummary>): MonthlySummary {
  return { month: '2026-07', income: 3000000, spending: 2000000, saving: 1000000, netCashFlow: 1000000, ...overrides }
}

describe('generateInsights', () => {
  it('generates a category-increase insight when one exists', () => {
    const txs = [
      tx({ date: '2026-07-10', category: '식비', amount: -80000 }),
      tx({ date: '2026-06-10', category: '식비', amount: -30000 }),
    ]
    const insights = generateInsights(txs, '2026-07', [])
    expect(insights.some((i) => i.text.includes('식비') && i.text.includes('늘었어요'))).toBe(true)
  })

  it('generates a subscription-total insight only when subscriptions exist', () => {
    const withSub = [
      tx({ date: '2026-06-01', content: '넷플릭스', amount: -17000 }),
      tx({ date: '2026-07-01', content: '넷플릭스', amount: -17000 }),
    ]
    expect(generateInsights(withSub, '2026-07', []).some((i) => i.text.includes('구독료'))).toBe(true)
    expect(generateInsights([], '2026-07', []).some((i) => i.text.includes('구독료'))).toBe(false)
  })

  it('generates a late-night-spending insight only when there is late-night spending in the given month', () => {
    const withLateNight = [tx({ date: '2026-07-10', time: '23:30:00', amount: -20000 })]
    expect(generateInsights(withLateNight, '2026-07', []).some((i) => i.text.includes('심야'))).toBe(true)
    const noLateNight = [tx({ date: '2026-07-10', time: '13:00:00', amount: -20000 })]
    expect(generateInsights(noLateNight, '2026-07', []).some((i) => i.text.includes('심야'))).toBe(false)
  })

  it('generates a savings-change insight only when both this month and last month have a summary', () => {
    const summaries = [summary({ month: '2026-06', saving: 500000 }), summary({ month: '2026-07', saving: 900000 })]
    expect(generateInsights([], '2026-07', summaries).some((i) => i.text.includes('저축액'))).toBe(true)
    expect(generateInsights([], '2026-07', [summary({ month: '2026-07' })]).some((i) => i.text.includes('저축액'))).toBe(
      false
    )
  })

  it('returns an empty array when no condition is met', () => {
    expect(generateInsights([], '2026-07', [])).toEqual([])
  })
})

describe('projectAnnualSaving', () => {
  it('projects the trailing 3-month average saving times 12', () => {
    const summaries = [summary({ month: '2026-05', saving: 300000 }), summary({ month: '2026-06', saving: 500000 }), summary({ month: '2026-07', saving: 700000 })]
    expect(projectAnnualSaving(summaries)).toBe(6000000) // avg 500000 * 12
  })

  it('averages over fewer than 3 months when that is all that exists', () => {
    expect(projectAnnualSaving([summary({ saving: 400000 })])).toBe(4800000)
  })

  it('returns 0 for no data', () => {
    expect(projectAnnualSaving([])).toBe(0)
  })
})

describe('simulateSavings', () => {
  it('sums baseline * reduction * 12 across categories', () => {
    const result = simulateSavings({ 식비: 100000, '카페/간식': 20000 }, { 식비: 0.2 })
    expect(result).toBe(240000) // 100000 * 0.2 * 12; 카페/간식 has no entry in reductionByCategory -> 0
  })

  it('returns 0 when no reductions are set', () => {
    expect(simulateSavings({ 식비: 100000 }, {})).toBe(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/analyticsAggregations.test.ts`
Expected: FAIL — `generateInsights`/`projectAnnualSaving`/`simulateSavings` are not exported yet.

- [ ] **Step 3: Update the import block and append the implementation**

At the top of `src/lib/analyticsAggregations.ts`, change:

```ts
import type { Transaction } from '../types/transaction'
import { resolvedFlowType } from './aggregations'
```

to:

```ts
import type { Transaction } from '../types/transaction'
import type { MonthlySummary } from './aggregations'
import { resolvedFlowType } from './aggregations'
import { formatKRW } from './format'
```

Append to the end of the file:

```ts
export interface Insight {
  text: string
}

export function generateInsights(
  transactions: Transaction[],
  month: string,
  monthlySummaries: MonthlySummary[]
): Insight[] {
  const insights: Insight[] = []

  const trends = categoryTrendRanking(transactions, month)
  const topIncrease = trends.find((t) => t.changeAmount > 0)
  if (topIncrease) {
    insights.push({
      text: `${topIncrease.category} 지출이 최근 3개월 평균보다 ${formatKRW(topIncrease.changeAmount)} 늘었어요`,
    })
  }
  const topDecrease = [...trends].reverse().find((t) => t.changeAmount < 0)
  if (topDecrease) {
    insights.push({
      text: `${topDecrease.category} 지출이 최근 3개월 평균보다 ${formatKRW(-topDecrease.changeAmount)} 줄었어요`,
    })
  }

  const subscriptions = detectSubscriptions(transactions)
  if (subscriptions.length > 0) {
    const total = subscriptions.reduce((sum, s) => sum + s.amount, 0)
    insights.push({ text: `이번 달 구독료로 총 ${formatKRW(total)}이 나갔어요 (${subscriptions.length}건)` })
  }

  const monthTx = transactions.filter((t) => t.date.slice(0, 7) === month)
  const lateNight = hourBucketSpending(monthTx).find((h) => h.bucket === '심야')
  if (lateNight && lateNight.amount > 0) {
    insights.push({ text: `심야(22시~24시) 지출이 ${formatKRW(lateNight.amount)}이에요` })
  }

  const currentSummary = monthlySummaries.find((s) => s.month === month)
  const previousSummary = monthlySummaries.find((s) => s.month === shiftMonth(month, -1))
  if (currentSummary && previousSummary) {
    const diff = currentSummary.saving - previousSummary.saving
    if (diff !== 0) {
      insights.push({
        text: `이번 달 저축액이 지난달보다 ${formatKRW(Math.abs(diff))} ${diff > 0 ? '늘었어요' : '줄었어요'}`,
      })
    }
  }

  return insights.slice(0, 5)
}

export function projectAnnualSaving(monthlySummaries: MonthlySummary[]): number {
  const trailing = monthlySummaries.slice(-3)
  if (trailing.length === 0) return 0
  const avgMonthlySaving = trailing.reduce((sum, s) => sum + s.saving, 0) / trailing.length
  return avgMonthlySaving * 12
}

export function simulateSavings(
  categoryBaselines: Record<string, number>,
  reductionByCategory: Record<string, number>
): number {
  return Object.entries(categoryBaselines).reduce((sum, [category, baseline]) => {
    const reduction = reductionByCategory[category] ?? 0
    return sum + baseline * reduction * 12
  }, 0)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/analyticsAggregations.test.ts`
Expected: PASS — all Task 1-4 cases green (should be ~25 test cases total in this file).

- [ ] **Step 5: Run the FULL suite to confirm no regressions**

Run: `npm run test`
Expected: PASS — every test file in the repo green, since this task only ever ADDED to a new file and only ever ADDED new imports (never modified an existing shared file).

- [ ] **Step 6: Commit**

```bash
git add src/lib/analyticsAggregations.ts src/lib/analyticsAggregations.test.ts
git commit -m "feat: auto-generated insight feed, annual savings projection, and savings simulator math"
```

---

### Task 5: `WeekdayChart` + `HourBucketChart`

**Files:**
- Create: `src/components/analytics/WeekdayChart.tsx`
- Create: `src/components/analytics/HourBucketChart.tsx`

**Interfaces:**
- Consumes: `weekdaySpending`, `hourBucketSpending` (Task 1); `formatKRW` (`src/lib/format.ts`); `Transaction` (`src/types/transaction.ts`).
- Produces (consumed by Task 8): `WeekdayChart` component (`{ transactions: Transaction[] }`), `HourBucketChart` component (`{ transactions: Transaction[] }`).

No test file — matches the established no-component-test pattern already used for every other `.tsx` file in this project (verified via `tsc`, not Vitest).

- [ ] **Step 1: Create `src/components/analytics/WeekdayChart.tsx`**

```tsx
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { weekdaySpending } from '../../lib/analyticsAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface WeekdayChartProps {
  transactions: Transaction[]
}

export default function WeekdayChart({ transactions }: WeekdayChartProps) {
  const data = weekdaySpending(transactions)

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-4 font-medium text-slate-700">요일별 지출</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="weekday" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => formatKRW(v)} tick={{ fontSize: 11 }} width={70} />
          <Tooltip formatter={(value: number) => formatKRW(value)} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="amount" fill="#2563eb" barSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/analytics/HourBucketChart.tsx`**

```tsx
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { hourBucketSpending } from '../../lib/analyticsAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface HourBucketChartProps {
  transactions: Transaction[]
}

export default function HourBucketChart({ transactions }: HourBucketChartProps) {
  const data = hourBucketSpending(transactions)

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-4 font-medium text-slate-700">시간대별 지출</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => formatKRW(v)} tick={{ fontSize: 11 }} width={70} />
          <Tooltip formatter={(value: number) => formatKRW(value)} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="amount" fill="#7c3aed" barSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: PASS — no `tsc` errors (both files are unused by anything yet, so this only checks they compile standalone).

- [ ] **Step 4: Commit**

```bash
git add src/components/analytics/WeekdayChart.tsx src/components/analytics/HourBucketChart.tsx
git commit -m "feat: weekday and hour-of-day spending bar charts"
```

---

### Task 6: `InsightFeed` + `CategoryTrendRanking`

**Files:**
- Create: `src/components/analytics/InsightFeed.tsx`
- Create: `src/components/analytics/CategoryTrendRanking.tsx`

**Interfaces:**
- Consumes: `Insight` type (Task 4); `categoryTrendRanking`, `CategoryTrend` type (Task 3); `formatKRW`; `Transaction`.
- Produces (consumed by Task 8): `InsightFeed` component (`{ insights: Insight[] }`), `CategoryTrendRanking` component (`{ transactions: Transaction[], month: string }`).

No test file (same rationale as Task 5).

- [ ] **Step 1: Create `src/components/analytics/InsightFeed.tsx`**

```tsx
import type { Insight } from '../../lib/analyticsAggregations'

interface InsightFeedProps {
  insights: Insight[]
}

export default function InsightFeed({ insights }: InsightFeedProps) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-4 font-medium text-slate-700">인사이트</p>
      {insights.length === 0 ? (
        <p className="text-sm text-slate-400">아직 표시할 인사이트가 없어요.</p>
      ) : (
        <ul className="space-y-2">
          {insights.map((insight, i) => (
            <li key={i} className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {insight.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/analytics/CategoryTrendRanking.tsx`**

```tsx
import { categoryTrendRanking } from '../../lib/analyticsAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface CategoryTrendRankingProps {
  transactions: Transaction[]
  month: string
}

export default function CategoryTrendRanking({ transactions, month }: CategoryTrendRankingProps) {
  const trends = categoryTrendRanking(transactions, month)
  const increases = trends.filter((t) => t.changeAmount > 0).slice(0, 3)
  const decreases = [...trends]
    .reverse()
    .filter((t) => t.changeAmount < 0)
    .slice(0, 3)

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-4 font-medium text-slate-700">카테고리 증감 랭킹 (직전 3개월 평균 대비)</p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium text-rose-600">증가</p>
          {increases.length === 0 ? (
            <p className="text-sm text-slate-400">증가한 카테고리가 없어요.</p>
          ) : (
            <ul className="space-y-1.5">
              {increases.map((t) => (
                <li key={t.category} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{t.category}</span>
                  <span className="text-rose-600">+{formatKRW(t.changeAmount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-blue-600">감소</p>
          {decreases.length === 0 ? (
            <p className="text-sm text-slate-400">감소한 카테고리가 없어요.</p>
          ) : (
            <ul className="space-y-1.5">
              {decreases.map((t) => (
                <li key={t.category} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{t.category}</span>
                  <span className="text-blue-600">{formatKRW(t.changeAmount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: PASS — no `tsc` errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/analytics/InsightFeed.tsx src/components/analytics/CategoryTrendRanking.tsx
git commit -m "feat: insight feed and category trend ranking widgets"
```

---

### Task 7: `SubscriptionList` + `SavingsSimulator`

**Files:**
- Create: `src/components/analytics/SubscriptionList.tsx`
- Create: `src/components/analytics/SavingsSimulator.tsx`

**Interfaces:**
- Consumes: `detectSubscriptions` (Task 2); `categoryTrendRanking`, `projectAnnualSaving`, `simulateSavings` (Tasks 3-4); `MonthlySummary` (`src/lib/aggregations.ts`); `formatKRW`; `Transaction`.
- Produces (consumed by Task 8): `SubscriptionList` component (`{ transactions: Transaction[] }`), `SavingsSimulator` component (`{ transactions: Transaction[], month: string, monthlySummaries: MonthlySummary[] }`).

No test file (same rationale as Task 5).

- [ ] **Step 1: Create `src/components/analytics/SubscriptionList.tsx`**

```tsx
import { detectSubscriptions } from '../../lib/analyticsAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface SubscriptionListProps {
  transactions: Transaction[]
}

export default function SubscriptionList({ transactions }: SubscriptionListProps) {
  const subscriptions = detectSubscriptions(transactions)
  const total = subscriptions.reduce((sum, s) => sum + s.amount, 0)

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-4 font-medium text-slate-700">구독·정기결제</p>
      {subscriptions.length === 0 ? (
        <p className="text-sm text-slate-400">최근 2개월 연속 반복된 결제가 없어요.</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-2">가맹점</th>
                <th className="pb-2 text-right">금액</th>
                <th className="pb-2 text-right">관측 월수</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={`${s.merchant}-${s.amount}`} className="border-b last:border-0">
                  <td className="py-1.5">{s.merchant}</td>
                  <td className="py-1.5 text-right">{formatKRW(s.amount)}</td>
                  <td className="py-1.5 text-right text-slate-400">{s.monthCount}개월</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm font-medium text-slate-700">
            <span>월 구독료 합계</span>
            <span>{formatKRW(total)}</span>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/analytics/SavingsSimulator.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { categoryTrendRanking, projectAnnualSaving, simulateSavings } from '../../lib/analyticsAggregations'
import { formatKRW } from '../../lib/format'
import type { MonthlySummary } from '../../lib/aggregations'
import type { Transaction } from '../../types/transaction'

interface SavingsSimulatorProps {
  transactions: Transaction[]
  month: string
  monthlySummaries: MonthlySummary[]
}

export default function SavingsSimulator({ transactions, month, monthlySummaries }: SavingsSimulatorProps) {
  const trends = useMemo(() => categoryTrendRanking(transactions, month), [transactions, month])
  const categoryBaselines = useMemo(
    () => Object.fromEntries(trends.map((t) => [t.category, t.baselineAmount])),
    [trends]
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
      <p className="mb-1 font-medium text-slate-700">저축 시뮬레이터</p>
      <p className="mb-4 text-2xl font-bold text-emerald-600">
        {formatKRW(baseProjection + extraFromSimulation)}
        <span className="ml-2 text-sm font-normal text-slate-400">연간 예상 저축액</span>
      </p>
      {Object.keys(categoryBaselines).length === 0 ? (
        <p className="text-sm text-slate-400">절감 시뮬레이션에 쓸 카테고리 데이터가 아직 없어요.</p>
      ) : (
        <ul className="space-y-3">
          {Object.entries(categoryBaselines).map(([category, baseline]) => (
            <li key={category}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-slate-700">{category}</span>
                <span className="text-slate-400">
                  {formatKRW(baseline)}/월 · {Math.round((reductionByCategory[category] ?? 0) * 100)}% 절감
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                step={5}
                value={Math.round((reductionByCategory[category] ?? 0) * 100)}
                onChange={(e) => setReduction(category, Number(e.target.value))}
                className="w-full"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: PASS — no `tsc` errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/analytics/SubscriptionList.tsx src/components/analytics/SavingsSimulator.tsx
git commit -m "feat: subscription list and interactive savings simulator widgets"
```

---

### Task 8: Wire up `AnalyticsPage`, routing, nav, and final verification

**Files:**
- Create: `src/pages/AnalyticsPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/AppShell.tsx`

**Interfaces:**
- Consumes: everything produced by Tasks 1-7, plus existing `useTransactionStore` (`transactions`), `listAvailableMonths`, `summarizeByMonth` (`src/lib/aggregations.ts`).
- Produces: the `/analytics` route, reachable from the nav bar.

No test file (page composition, same rationale as Task 5; verified via `tsc` + manual browser smoke test in Step 5).

- [ ] **Step 1: Create `src/pages/AnalyticsPage.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { useTransactionStore } from '../store/useTransactionStore'
import { listAvailableMonths, summarizeByMonth } from '../lib/aggregations'
import { generateInsights } from '../lib/analyticsAggregations'
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
  const latestMonth = availableMonths[availableMonths.length - 1]
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
    () => (latestMonth ? generateInsights(transactions, latestMonth, monthlySummaries) : []),
    [transactions, latestMonth, monthlySummaries]
  )

  if (!latestMonth) {
    return (
      <div className="rounded-xl bg-white p-6 text-slate-500 shadow-sm">
        불러온 데이터가 없습니다. 먼저 데이터를 불러와주세요.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">분석</h1>
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

      <div className="mb-6">
        <InsightFeed insights={insights} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <WeekdayChart transactions={periodTransactions} />
        <HourBucketChart transactions={periodTransactions} />
      </div>

      <div className="mb-6">
        <CategoryTrendRanking transactions={transactions} month={latestMonth} />
      </div>

      <div className="mb-6">
        <SubscriptionList transactions={periodTransactions} />
      </div>

      <div>
        <SavingsSimulator transactions={transactions} month={latestMonth} monthlySummaries={monthlySummaries} />
      </div>
    </div>
  )
}
```

Note: `CategoryTrendRanking` and `SavingsSimulator` deliberately receive the FULL `transactions` (not `periodTransactions`) — per the design doc, the "이번 달 vs 직전 3개월" comparison always anchors to the latest real data month regardless of the period toggle, so period-narrowing must not apply to them. `WeekdayChart`/`HourBucketChart`/`SubscriptionList` DO respect the period toggle.

- [ ] **Step 2: Wire the `/analytics` route into `src/App.tsx`**

Add the import alongside the other page imports:

```tsx
import AnalyticsPage from './pages/AnalyticsPage'
```

Add the route inside `<Routes>`, alongside the existing routes:

```tsx
          <Route path="/analytics" element={<AnalyticsPage />} />
```

- [ ] **Step 3: Add the nav link in `src/components/AppShell.tsx`**

Change `navItems` to:

```tsx
const navItems = [
  { to: '/', label: '대시보드', end: true },
  { to: '/entries', label: '거래 관리', end: false },
  { to: '/analytics', label: '분석', end: false },
  { to: '/import', label: '불러오기', end: false },
]
```

- [ ] **Step 4: Verify the build and full test suite**

Run: `npm run build`
Expected: PASS — no `tsc` errors.

Run: `npm run test`
Expected: PASS — full suite green, including all `analyticsAggregations.test.ts` cases from Tasks 1-4.

- [ ] **Step 5: Manual browser smoke test**

Run: `npm run dev`, log in, navigate to `/analytics`, and verify by hand:
- Page renders with all 6 sections: 인사이트, 요일별/시간대별 차트, 카테고리 증감 랭킹, 구독 목록, 저축 시뮬레이터.
- 6개월/12개월/전체 토글 클릭 시 요일별/시간대별 차트와 구독 목록이 갱신된다 (카테고리 랭킹/시뮬레이터는 토글과 무관하게 최신 월 기준 고정).
- 저축 시뮬레이터의 슬라이더를 움직이면 상단 "연간 예상 저축액" 숫자가 실시간으로 바뀐다.
- 데이터가 아예 없는 상태에서는 "불러온 데이터가 없습니다" 안내가 뜬다 (다른 화면과 동일 패턴).
- 인사이트/구독/증감 랭킹 카드는 조건이 안 맞으면(예: 3개월치 데이터가 없는 신규 계정) 빈 상태 문구가 뜨고 에러가 나지 않는다.

Report the outcome (pass/fail per bullet) before moving to code review.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AnalyticsPage.tsx src/App.tsx src/components/AppShell.tsx
git commit -m "feat: analytics page — insights, time patterns, category trends, subscriptions, savings simulator"
```

---
