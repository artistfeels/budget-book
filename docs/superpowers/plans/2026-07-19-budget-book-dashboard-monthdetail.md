# Dashboard + Month Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the main Dashboard (`/`) and Month Detail (`/month/:yyyyMm`) screens on top of the foundation phase, per the original spec's "화면 구성" sections 1 and 2.

**Architecture:** Add client-side routing (react-router-dom, already a dependency but unused) with a shared `AppShell` nav. Add two new pure/tested aggregation modules (`src/lib/dashboardAggregations.ts`, `src/lib/monthDetailAggregations.ts`) that derive chart-ready data from `useTransactionStore().transactions` — no new server calls, no schema changes. Each screen is composed from small, focused widget components under `src/components/dashboard/` and `src/components/month/`.

**Tech Stack:** React 18 + TypeScript, react-router-dom v6, Recharts v2, date-fns v3, Tailwind CSS, Zustand (existing store, unchanged).

## Global Constraints

- Source docs: `docs/superpowers/specs/2026-07-19-budget-book-design.md` (architecture/data rules) and `가계부앱_클로드코드_첫프롬프트.md` lines 129-192 ("화면 구성" / "디자인" — the two screens this plan builds) and lines 82-99 (KPI/flowType definitions, already implemented in `src/lib/classification.ts` and `src/lib/aggregations.ts`).
- Colors (already established, keep using these exact Tailwind utility classes, not the unused `income`/`spending`/`saving` custom Tailwind theme colors from `tailwind.config.js`): 수입 = `text-blue-600`/`bg-blue-600`, 지출 = `text-rose-600`/`bg-rose-600`, 저축 = `text-emerald-600`/`bg-emerald-600`. This matches `src/pages/ImportPage.tsx`'s existing convention.
- Currency formatting: reuse `formatKRW` (exact 원 format) and `formatManwon` (만원 abbreviation) from `src/lib/format.ts` (Task 5, already built) — do not create new formatters.
- All amounts read from `Transaction.amount` are signed as stored; when a widget needs a positive spending magnitude, use the same `Math.max(0, -sum)` convention already established in `src/lib/aggregations.ts:summarizeByMonth` (never `Math.abs`, which double-counts over-refunded buckets — see that file's existing comment).
- Month keys are `YYYY-MM` strings everywhere (`transaction.date.slice(0, 7)`), matching `src/lib/aggregations.ts`'s existing convention. Weeks are Monday-start (월~일), matching the original spec's calendar section.
- **Scope boundary (do not build in this plan):** the day-click transaction list on the Month Detail calendar is **read-only** (view only, no add/edit/delete). Full inline CRUD editing lives in the `/entries` page, which is explicitly a separate future plan (Phase 4 — "거래 입력/관리"), per `docs/superpowers/specs/2026-07-19-budget-book-design.md` section 4 and `README.md`'s "What's next" note. Do not add edit/delete affordances to the day panel built in Task 14.
- No dark mode (existing scope exclusion, unchanged).
- Git repo: commit directly to `master` after every task (established pattern for this project — no feature branch).
- Existing store shape (`src/store/useTransactionStore.ts`, unchanged by this plan): `{ transactions: Transaction[], rules: ClassificationRule[], loading: boolean, fetchAll, importRows, updateTransaction, deleteTransaction, setOverride, addRule }`. Read via `useTransactionStore((s) => s.transactions)`.
- Existing `Transaction` type (`src/types/transaction.ts`, unchanged): `{ id, date: string (YYYY-MM-DD), time: string (HH:MM:SS), type: '수입'|'지출'|'이체', category, subcategory, content, amount: number, currency, paymentMethod, memo, flowType: 'income'|'saving'|'spending'|'neutral', flowTypeOverride: 'saving'|'spending'|null, transferPairId, isPairedTransfer, isUnmatchedTransfer }`.
- Existing `resolvedFlowType(tx): FlowType` (`src/lib/aggregations.ts`) always resolves override-vs-computed — every new aggregation function that buckets by flow type MUST call `resolvedFlowType(t)`, never read `t.flowType` directly (that would ignore manual overrides).

**Deliberate scope reductions from the original spec (`가계부앱_클로드코드_첫프롬프트.md` lines 129-158), flagged here rather than silently built partial:**
- **"커스텀" period on the Dashboard** (원본 스펙 133행: "기간 선택... 커스텀"): this plan's period selector (Task 5) only implements 전체/최근6개월/최근12개월. A custom date-range picker is a separate, non-trivial UI (needs a from/to month picker and validation) — deferred to a follow-up rather than bolted on here. Flag this for the human to confirm before/after implementation.
- **Weekly band click-to-filter** (원본 스펙 147행: "띠를 클릭하면 그 주 거래만 필터링"): Task 13's `CalendarGrid` renders the band and its totals but does not wire a click handler on the band itself (only individual day cells are clickable, via Task 14's day panel). Adding week-range filtering would require generalizing `DayTransactionPanel` to accept a date range instead of a single date — deferred; the day-level panel already covers the core "see transactions for a period" need.
- **Category breakdown richness on Month Detail** (원본 스펙 157행: "카테고리별 지출 분포: 도넛 + 대분류별 가로 막대(금액, 건수, 평균 단가, 전월 대비 증감)"): Task 16 reuses the Dashboard's `CategoryDonut` (donut + amount/percent list) as-is rather than building the richer bar-chart-with-4-metrics view the month-detail spec describes. `AmountBreakdownItem` (Task 3) already carries `count`, so a follow-up task could add avg-unit-price (`amount/count`) and a per-category MoM comparison without touching the aggregation layer.

These three items should be confirmed with the human before or during execution — they are gaps against the original spec, not oversights to silently ship.

---

### Task 1: React Router shell + AppShell nav

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Create: `src/components/AppShell.tsx`

**Interfaces:**
- Consumes: `AuthGuard` (Task 13), `useTransactionStore` (Task 12), `ImportPage` (Task 14).
- Produces: routes `/` (Dashboard, placeholder in this task), `/month/:yyyyMm` (Month Detail, placeholder in this task), `/import` (existing `ImportPage`) — consumed by Tasks 5 and 13 which replace the placeholders.

No test file (routing/layout wiring only, matches the no-TDD pattern already used for `LoginPage`/`AuthGuard`/`ImportPage`).

- [ ] **Step 1: Wrap the app in `BrowserRouter`**

Modify `src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

- [ ] **Step 2: Create `src/components/AppShell.tsx`**

```tsx
import { NavLink, type ReactNode } from 'react-router-dom'

const navItems = [
  { to: '/', label: '대시보드', end: true },
  { to: '/import', label: '불러오기', end: false },
]

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-8 py-4">
          <span className="text-lg font-bold text-slate-800">가계부</span>
          <nav className="flex gap-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium ${
                    isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-800'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-8 py-8">{children}</main>
    </div>
  )
}
```

Note: `NavLink`'s type import — `ReactNode` actually comes from `'react'`, not `'react-router-dom'`. Use two import statements:

```tsx
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
```

- [ ] **Step 3: Wire routes into `src/App.tsx`**

```tsx
import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import AuthGuard from './auth/AuthGuard'
import AppShell from './components/AppShell'
import ImportPage from './pages/ImportPage'
import { useTransactionStore } from './store/useTransactionStore'

function DashboardPlaceholder() {
  return <div className="rounded-xl bg-white p-6 shadow-sm">대시보드 (다음 태스크에서 구현)</div>
}

function MonthDetailPlaceholder() {
  return <div className="rounded-xl bg-white p-6 shadow-sm">월별 상세 (다음 태스크에서 구현)</div>
}

export default function App() {
  const fetchAll = useTransactionStore((s) => s.fetchAll)

  useEffect(() => {
    fetchAll().catch((error) => {
      console.error('Failed to fetch transactions:', error)
    })
  }, [fetchAll])

  return (
    <AuthGuard>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPlaceholder />} />
          <Route path="/month/:yyyyMm" element={<MonthDetailPlaceholder />} />
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </AppShell>
    </AuthGuard>
  )
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`, open the printed URL, confirm the nav bar shows "대시보드" and "불러오기" links, clicking "불러오기" shows the existing Import page unchanged, and navigating to `/month/2026-07` directly in the URL bar shows the placeholder text.

- [ ] **Step 6: Commit**

```bash
git add src/main.tsx src/App.tsx src/components/AppShell.tsx
git commit -m "feat: add router shell and app nav (dashboard/month/import routes)"
```

---

### Task 2: `monthOverMonthChange` helper

**Files:**
- Modify: `src/lib/aggregations.ts`
- Test: `src/lib/aggregations.test.ts`

**Interfaces:**
- Produces: `monthOverMonthChange(current: number, previous: number): number | null` — consumed by Task 5 (KPI cards) and Task 16 (month summary card).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/aggregations.test.ts` (append a new `describe` block after the existing `listAvailableMonths` block):

```ts
describe('monthOverMonthChange', () => {
  it('computes a positive percent increase', () => {
    expect(monthOverMonthChange(120, 100)).toBeCloseTo(0.2)
  })

  it('computes a negative percent decrease', () => {
    expect(monthOverMonthChange(80, 100)).toBeCloseTo(-0.2)
  })

  it('returns null when the previous value is zero (undefined percent change)', () => {
    expect(monthOverMonthChange(50, 0)).toBeNull()
  })
})
```

Update the import line at the top of the file to include the new function:

```ts
import { listAvailableMonths, monthOverMonthChange, resolvedFlowType, summarizeByMonth } from './aggregations'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- aggregations`
Expected: FAIL — `monthOverMonthChange is not a function` (or a TS error if run through `tsc` first; the test failure itself is what matters).

- [ ] **Step 3: Implement**

Add to the end of `src/lib/aggregations.ts`:

```ts
export function monthOverMonthChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return (current - previous) / previous
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- aggregations`
Expected: all tests in the file pass (12 total: 9 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/aggregations.ts src/lib/aggregations.test.ts
git commit -m "feat: add monthOverMonthChange helper for KPI/summary deltas"
```

---

### Task 3: Category, merchant, and payment-method spending breakdowns

**Files:**
- Create: `src/lib/dashboardAggregations.ts`
- Test: `src/lib/dashboardAggregations.test.ts`

**Interfaces:**
- Consumes: `Transaction`, `resolvedFlowType` (Task 2's file, `src/lib/aggregations.ts`).
- Produces: `AmountBreakdownItem`, `categoryBreakdown(transactions, includeSaving?): AmountBreakdownItem[]`, `subcategoryBreakdown(transactions, category, includeSaving?): AmountBreakdownItem[]`, `topMerchants(transactions, limit?): AmountBreakdownItem[]`, `paymentMethodBreakdown(transactions): AmountBreakdownItem[]` — consumed by Task 5 (Dashboard KPI/period filtering happens by the caller pre-filtering the `transactions` array before calling these), Task 7 (category donut, wires up the "저축 포함" toggle from `가계부앱_클로드코드_첫프롬프트.md:99`), Task 9 (top merchants + payment pie), Task 16 (month category breakdown).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { categoryBreakdown, paymentMethodBreakdown, subcategoryBreakdown, topMerchants } from './dashboardAggregations'
import type { Transaction } from '../types/transaction'

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'id',
    date: '2026-07-01',
    time: '00:00:00',
    type: '지출',
    category: '식비',
    subcategory: '배달',
    content: '테스트가게',
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

describe('categoryBreakdown', () => {
  it('sums spending amounts per category, largest first', () => {
    const txs = [
      tx({ category: '식비', amount: -10000 }),
      tx({ category: '식비', amount: -5000 }),
      tx({ category: '교통', amount: -30000 }),
    ]
    expect(categoryBreakdown(txs)).toEqual([
      { label: '교통', amount: 30000, count: 1 },
      { label: '식비', amount: 15000, count: 2 },
    ])
  })

  it('excludes non-spending flow types', () => {
    const txs = [
      tx({ category: '급여', amount: 3000000, flowType: 'income', type: '수입' }),
      tx({ category: '내계좌이체', amount: -50000, flowType: 'neutral', type: '이체' }),
    ]
    expect(categoryBreakdown(txs)).toEqual([])
  })

  it('respects a manual flowTypeOverride when bucketing', () => {
    const txs = [tx({ category: '식비', amount: -10000, flowType: 'spending', flowTypeOverride: 'saving' })]
    expect(categoryBreakdown(txs)).toEqual([])
  })

  it('includes saving-flow transactions only when includeSaving is true', () => {
    const txs = [
      tx({ category: '금융', amount: -20000, flowType: 'saving', subcategory: '증권/투자' }),
      tx({ category: '식비', amount: -10000, flowType: 'spending' }),
    ]
    expect(categoryBreakdown(txs)).toEqual([{ label: '식비', amount: 10000, count: 1 }])
    expect(categoryBreakdown(txs, true)).toEqual([
      { label: '금융', amount: 20000, count: 1 },
      { label: '식비', amount: 10000, count: 1 },
    ])
  })
})

describe('subcategoryBreakdown', () => {
  it('scopes to one category and buckets by subcategory', () => {
    const txs = [
      tx({ category: '식비', subcategory: '배달', amount: -10000 }),
      tx({ category: '식비', subcategory: '한식', amount: -20000 }),
      tx({ category: '교통', subcategory: '택시', amount: -5000 }),
    ]
    expect(subcategoryBreakdown(txs, '식비')).toEqual([
      { label: '한식', amount: 20000, count: 1 },
      { label: '배달', amount: 10000, count: 1 },
    ])
  })
})

describe('topMerchants', () => {
  it('sums by content and limits to the given count, largest first', () => {
    const txs = [
      tx({ content: '가게A', amount: -1000 }),
      tx({ content: '가게A', amount: -2000 }),
      tx({ content: '가게B', amount: -5000 }),
      tx({ content: '가게C', amount: -500 }),
    ]
    expect(topMerchants(txs, 2)).toEqual([
      { label: '가게B', amount: 5000, count: 1 },
      { label: '가게A', amount: 3000, count: 2 },
    ])
  })
})

describe('paymentMethodBreakdown', () => {
  it('sums spending by payment method', () => {
    const txs = [
      tx({ paymentMethod: '삼성카드 taptap O', amount: -10000 }),
      tx({ paymentMethod: '네이버페이 머니', amount: -20000 }),
    ]
    expect(paymentMethodBreakdown(txs)).toEqual([
      { label: '네이버페이 머니', amount: 20000, count: 1 },
      { label: '삼성카드 taptap O', amount: 10000, count: 1 },
    ])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- dashboardAggregations`
Expected: FAIL — `Cannot find module './dashboardAggregations'`

- [ ] **Step 3: Implement**

```ts
import type { Transaction } from '../types/transaction'
import { resolvedFlowType } from './aggregations'

export interface AmountBreakdownItem {
  label: string
  amount: number
  count: number
}

function bucketBySpending(
  transactions: Transaction[],
  keyFn: (t: Transaction) => string,
  includeSaving = false
): AmountBreakdownItem[] {
  const buckets = new Map<string, { amount: number; count: number }>()
  for (const t of transactions) {
    const flow = resolvedFlowType(t)
    if (flow !== 'spending' && !(includeSaving && flow === 'saving')) continue
    const key = keyFn(t)
    const bucket = buckets.get(key) ?? { amount: 0, count: 0 }
    bucket.amount += t.amount
    bucket.count += 1
    buckets.set(key, bucket)
  }
  return [...buckets.entries()]
    .map(([label, b]) => ({ label, amount: Math.max(0, -b.amount), count: b.count }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
}

export function categoryBreakdown(transactions: Transaction[], includeSaving = false): AmountBreakdownItem[] {
  return bucketBySpending(transactions, (t) => t.category, includeSaving)
}

export function subcategoryBreakdown(
  transactions: Transaction[],
  category: string,
  includeSaving = false
): AmountBreakdownItem[] {
  return bucketBySpending(
    transactions.filter((t) => t.category === category),
    (t) => t.subcategory,
    includeSaving
  )
}

export function topMerchants(transactions: Transaction[], limit = 10): AmountBreakdownItem[] {
  return bucketBySpending(transactions, (t) => t.content).slice(0, limit)
}

export function paymentMethodBreakdown(transactions: Transaction[]): AmountBreakdownItem[] {
  return bucketBySpending(transactions, (t) => t.paymentMethod)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- dashboardAggregations`
Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboardAggregations.ts src/lib/dashboardAggregations.test.ts
git commit -m "feat: category/subcategory/merchant/payment-method spending breakdowns"
```

---

### Task 4: Category × month heatmap aggregation

**Files:**
- Modify: `src/lib/dashboardAggregations.ts`
- Test: `src/lib/dashboardAggregations.test.ts`

**Interfaces:**
- Produces: `CategoryMonthHeatmap`, `categoryMonthHeatmap(transactions): CategoryMonthHeatmap` — consumed by Task 8 (heatmap UI).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/dashboardAggregations.test.ts`:

```ts
describe('categoryMonthHeatmap', () => {
  it('builds a category x month spending matrix, categories sorted by total desc, months asc', () => {
    const txs = [
      tx({ date: '2026-07-05', category: '식비', amount: -10000 }),
      tx({ date: '2026-06-05', category: '식비', amount: -5000 }),
      tx({ date: '2026-07-10', category: '교통', amount: -30000 }),
    ]
    const result = categoryMonthHeatmap(txs)
    expect(result.months).toEqual(['2026-06', '2026-07'])
    expect(result.categories).toEqual(['교통', '식비'])
    expect(result.amounts['교통']).toEqual({ '2026-07': 30000 })
    expect(result.amounts['식비']).toEqual({ '2026-06': 5000, '2026-07': 10000 })
  })

  it('excludes non-spending flow types', () => {
    const txs = [tx({ category: '내계좌이체', amount: -1000, flowType: 'neutral', type: '이체' })]
    const result = categoryMonthHeatmap(txs)
    expect(result.categories).toEqual([])
    expect(result.months).toEqual([])
  })
})
```

Update the import at the top of the test file:

```ts
import { categoryBreakdown, categoryMonthHeatmap, paymentMethodBreakdown, subcategoryBreakdown, topMerchants } from './dashboardAggregations'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- dashboardAggregations`
Expected: FAIL — `categoryMonthHeatmap is not a function`

- [ ] **Step 3: Implement**

Append to `src/lib/dashboardAggregations.ts`:

```ts
export interface CategoryMonthHeatmap {
  categories: string[]
  months: string[]
  amounts: Record<string, Record<string, number>>
}

export function categoryMonthHeatmap(transactions: Transaction[]): CategoryMonthHeatmap {
  const amounts: Record<string, Record<string, number>> = {}
  const monthsSet = new Set<string>()

  for (const t of transactions) {
    if (resolvedFlowType(t) !== 'spending') continue
    const month = t.date.slice(0, 7)
    monthsSet.add(month)
    if (!amounts[t.category]) amounts[t.category] = {}
    amounts[t.category][month] = (amounts[t.category][month] ?? 0) + t.amount
  }

  const totalByCategory = new Map<string, number>()
  for (const category of Object.keys(amounts)) {
    let total = 0
    for (const month of Object.keys(amounts[category])) {
      const positive = Math.max(0, -amounts[category][month])
      amounts[category][month] = positive
      total += positive
    }
    totalByCategory.set(category, total)
  }

  const categories = Object.keys(amounts).sort((a, b) => totalByCategory.get(b)! - totalByCategory.get(a)!)
  const months = [...monthsSet].sort()

  return { categories, months, amounts }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- dashboardAggregations`
Expected: `9 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboardAggregations.ts src/lib/dashboardAggregations.test.ts
git commit -m "feat: category-by-month spending heatmap aggregation"
```

---

### Task 5: Dashboard skeleton — period selector + KPI cards

**Files:**
- Create: `src/pages/DashboardPage.tsx`
- Create: `src/components/dashboard/KpiCards.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useTransactionStore` (Task 12), `listAvailableMonths`, `summarizeByMonth`, `monthOverMonthChange` (`src/lib/aggregations.ts`), `formatKRW`, `formatManwon` (`src/lib/format.ts`).
- Produces: `DashboardPage` mounted at `/`, `KpiCards` component reusable as-is — consumed by Tasks 6-9 which add chart widgets below the KPI row inside `DashboardPage`.

No test file (page/widget composition, matches the established no-TDD pattern for page-level UI).

- [ ] **Step 1: Create `src/components/dashboard/KpiCards.tsx`**

```tsx
import { formatKRW, formatManwon } from '../../lib/format'
import { monthOverMonthChange } from '../../lib/aggregations'

interface KpiCardsProps {
  income: number
  spending: number
  saving: number
  netCashFlow: number
  savingsRate: number | null
  previousIncome: number | null
  previousSpending: number | null
  previousSaving: number | null
  compact: boolean
  onToggleCompact: () => void
}

function DeltaBadge({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) return null
  const change = monthOverMonthChange(current, previous)
  if (change === null) return null
  const isUp = change > 0
  return (
    <span className={`ml-2 text-xs font-medium ${isUp ? 'text-rose-600' : 'text-emerald-600'}`}>
      {isUp ? '▲' : '▼'} {Math.abs(change * 100).toFixed(1)}%
    </span>
  )
}

export default function KpiCards({
  income,
  spending,
  saving,
  netCashFlow,
  savingsRate,
  previousIncome,
  previousSpending,
  previousSaving,
  compact,
  onToggleCompact,
}: KpiCardsProps) {
  const fmt = compact ? formatManwon : formatKRW

  const cards = [
    { label: '총수입', value: income, color: 'text-blue-600', previous: previousIncome },
    { label: '소비지출', value: spending, color: 'text-rose-600', previous: previousSpending },
    { label: '저축·투자', value: saving, color: 'text-emerald-600', previous: previousSaving },
    {
      label: '실질 저축률',
      value: savingsRate === null ? '—' : `${(savingsRate * 100).toFixed(1)}%`,
      color: 'text-slate-800',
      previous: null,
    },
    { label: '순현금흐름', value: netCashFlow, color: netCashFlow >= 0 ? 'text-blue-600' : 'text-rose-600', previous: null },
  ]

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input type="checkbox" checked={compact} onChange={onToggleCompact} />
          만원 단위로 표시
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl bg-white p-5 shadow-sm">
            <p className="mb-2 text-sm text-slate-500">{card.label}</p>
            <p className={`text-xl font-bold ${card.color}`}>
              {typeof card.value === 'number' ? fmt(card.value) : card.value}
              {typeof card.value === 'number' && card.previous !== null && (
                <DeltaBadge current={card.value} previous={card.previous} />
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/pages/DashboardPage.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { listAvailableMonths, summarizeByMonth } from '../lib/aggregations'
import { useTransactionStore } from '../store/useTransactionStore'
import KpiCards from '../components/dashboard/KpiCards'

type Period = 'all' | '6m' | '12m'

export default function DashboardPage() {
  const transactions = useTransactionStore((s) => s.transactions)
  const [period, setPeriod] = useState<Period>('12m')
  const [compact, setCompact] = useState(false)

  const availableMonths = useMemo(() => listAvailableMonths(transactions), [transactions])

  const selectedMonths = useMemo(() => {
    if (period === 'all') return availableMonths
    const count = period === '6m' ? 6 : 12
    return availableMonths.slice(-count)
  }, [availableMonths, period])

  const monthlySummaries = useMemo(() => summarizeByMonth(transactions), [transactions])

  const summariesInPeriod = useMemo(
    () => monthlySummaries.filter((s) => selectedMonths.includes(s.month)),
    [monthlySummaries, selectedMonths]
  )

  const totals = useMemo(() => {
    const income = summariesInPeriod.reduce((sum, s) => sum + s.income, 0)
    const spending = summariesInPeriod.reduce((sum, s) => sum + s.spending, 0)
    const saving = summariesInPeriod.reduce((sum, s) => sum + s.saving, 0)
    const netCashFlow = income - spending - saving
    const savingsRate = income > 0 ? (income - spending) / income : null
    return { income, spending, saving, netCashFlow, savingsRate }
  }, [summariesInPeriod])

  const previousMonth = useMemo(() => {
    const lastTwo = monthlySummaries.slice(-2)
    return lastTwo.length === 2 ? lastTwo[0] : undefined
  }, [monthlySummaries])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">대시보드</h1>
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

      <KpiCards
        income={totals.income}
        spending={totals.spending}
        saving={totals.saving}
        netCashFlow={totals.netCashFlow}
        savingsRate={totals.savingsRate}
        previousIncome={previousMonth ? previousMonth.income : null}
        previousSpending={previousMonth ? previousMonth.spending : null}
        previousSaving={previousMonth ? previousMonth.saving : null}
        compact={compact}
        onToggleCompact={() => setCompact((c) => !c)}
      />
    </div>
  )
}
```

- [ ] **Step 3: Wire `DashboardPage` into `src/App.tsx`**

Replace the `DashboardPlaceholder` function and its route in `src/App.tsx`:

```tsx
import DashboardPage from './pages/DashboardPage'
```

```tsx
<Route path="/" element={<DashboardPage />} />
```

Remove the now-unused `DashboardPlaceholder` function definition.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual check**

Run: `npm run dev`, open `/`, confirm 5 KPI cards render with real numbers from the imported data, the period buttons change the totals, and the "만원 단위로 표시" checkbox toggles the number format.

- [ ] **Step 6: Commit**

```bash
git add src/pages/DashboardPage.tsx src/components/dashboard/KpiCards.tsx src/App.tsx
git commit -m "feat: dashboard page with period selector and KPI cards"
```

---

### Task 6: Monthly trend chart

**Files:**
- Create: `src/components/dashboard/MonthlyTrendChart.tsx`
- Modify: `src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `MonthlySummary[]` (`src/lib/aggregations.ts`), `formatManwon` (`src/lib/format.ts`), `useNavigate` (react-router-dom).
- Produces: `MonthlyTrendChart` component — consumed only by `DashboardPage`.

- [ ] **Step 1: Create `src/components/dashboard/MonthlyTrendChart.tsx`**

```tsx
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useNavigate } from 'react-router-dom'
import type { MonthlySummary } from '../../lib/aggregations'
import { formatKRW, formatManwon } from '../../lib/format'

interface MonthlyTrendChartProps {
  summaries: MonthlySummary[]
}

export default function MonthlyTrendChart({ summaries }: MonthlyTrendChartProps) {
  const navigate = useNavigate()

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-4 font-medium text-slate-700">월별 추이</p>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={summaries}
          onClick={(state) => {
            const month = state?.activeLabel
            if (typeof month === 'string') navigate(`/month/${month}`)
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => formatManwon(v)} tick={{ fontSize: 12 }} width={70} />
          <Tooltip formatter={(value: number) => formatKRW(value)} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="income" name="수입" fill="#2563eb" barSize={24} />
          <Bar dataKey="spending" name="소비지출" stackId="outflow" fill="#e11d48" barSize={24} />
          <Bar dataKey="saving" name="저축·투자" stackId="outflow" fill="#059669" barSize={24} />
          <Line type="monotone" dataKey="netCashFlow" name="순현금흐름" stroke="#0f172a" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-slate-400">막대를 클릭하면 해당 월의 상세 화면으로 이동합니다.</p>
    </div>
  )
}
```

- [ ] **Step 2: Wire into `DashboardPage`**

In `src/pages/DashboardPage.tsx`, import and render below `KpiCards`:

```tsx
import MonthlyTrendChart from '../components/dashboard/MonthlyTrendChart'
```

```tsx
<div className="mt-6">
  <MonthlyTrendChart summaries={summariesInPeriod} />
</div>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open `/`, confirm the chart renders with stacked spending/saving bars, an income bar, and a net cash flow line; clicking a bar navigates to `/month/<that month>`.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/MonthlyTrendChart.tsx src/pages/DashboardPage.tsx
git commit -m "feat: monthly trend composed chart with click-to-drill-down"
```

---

### Task 7: Category donut chart with subcategory drill-down

**Files:**
- Create: `src/components/dashboard/CategoryDonut.tsx`
- Modify: `src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `categoryBreakdown`, `subcategoryBreakdown`, `AmountBreakdownItem` (`src/lib/dashboardAggregations.ts`), `formatKRW` (`src/lib/format.ts`).
- Produces: `CategoryDonut` component — consumed only by `DashboardPage`.

- [ ] **Step 1: Create `src/components/dashboard/CategoryDonut.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { categoryBreakdown, subcategoryBreakdown, type AmountBreakdownItem } from '../../lib/dashboardAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

const COLORS = ['#2563eb', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#475569', '#ea580c']

interface CategoryDonutProps {
  transactions: Transaction[]
}

export default function CategoryDonut({ transactions }: CategoryDonutProps) {
  const [drilldown, setDrilldown] = useState<string | null>(null)
  const [includeSaving, setIncludeSaving] = useState(false)

  const items: AmountBreakdownItem[] = useMemo(
    () =>
      drilldown
        ? subcategoryBreakdown(transactions, drilldown, includeSaving)
        : categoryBreakdown(transactions, includeSaving),
    [transactions, drilldown, includeSaving]
  )

  const total = items.reduce((sum, i) => sum + i.amount, 0)

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-medium text-slate-700">
          지출 카테고리 구성 {drilldown && <span className="text-slate-400">/ {drilldown}</span>}
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <input type="checkbox" checked={includeSaving} onChange={(e) => setIncludeSaving(e.target.checked)} />
            저축 포함
          </label>
          {drilldown && (
            <button onClick={() => setDrilldown(null)} className="text-sm text-blue-600 hover:underline">
              ← 대분류로 돌아가기
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="sm:w-1/2">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={items}
                dataKey="amount"
                nameKey="label"
                innerRadius={60}
                outerRadius={100}
                onClick={(entry) => {
                  if (!drilldown) setDrilldown(entry.label)
                }}
              >
                {items.map((item, i) => (
                  <Cell key={item.label} fill={COLORS[i % COLORS.length]} cursor={drilldown ? 'default' : 'pointer'} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatKRW(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {items.map((item, i) => (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {item.label}
              </span>
              <span className="text-slate-600">
                {formatKRW(item.amount)} ({total > 0 ? ((item.amount / total) * 100).toFixed(1) : '0'}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into `DashboardPage`**

```tsx
import CategoryDonut from '../components/dashboard/CategoryDonut'
```

```tsx
<div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
  <CategoryDonut transactions={transactions.filter((t) => selectedMonths.includes(t.date.slice(0, 7)))} />
</div>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open `/`, confirm the donut renders with a legend list, clicking a slice drills into subcategories for that category, "← 대분류로 돌아가기" returns to the top level, and checking "저축 포함" adds saving-flow categories (e.g. 금융/증권투자) into the breakdown.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/CategoryDonut.tsx src/pages/DashboardPage.tsx
git commit -m "feat: category donut chart with subcategory drill-down"
```

---

### Task 8: Category × month heatmap UI

**Files:**
- Create: `src/components/dashboard/CategoryHeatmap.tsx`
- Modify: `src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `categoryMonthHeatmap`, `CategoryMonthHeatmap` (`src/lib/dashboardAggregations.ts`), `formatKRW` (`src/lib/format.ts`).
- Produces: `CategoryHeatmap` component — consumed only by `DashboardPage`.

- [ ] **Step 1: Create `src/components/dashboard/CategoryHeatmap.tsx`**

```tsx
import { useMemo } from 'react'
import { categoryMonthHeatmap } from '../../lib/dashboardAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface CategoryHeatmapProps {
  transactions: Transaction[]
}

export default function CategoryHeatmap({ transactions }: CategoryHeatmapProps) {
  const { categories, months, amounts } = useMemo(() => categoryMonthHeatmap(transactions), [transactions])

  const maxAmount = useMemo(() => {
    let max = 0
    for (const category of categories) {
      for (const month of months) {
        max = Math.max(max, amounts[category]?.[month] ?? 0)
      }
    }
    return max
  }, [categories, months, amounts])

  function cellStyle(value: number) {
    if (maxAmount === 0 || value === 0) return { backgroundColor: '#f8fafc' }
    const intensity = 0.1 + (value / maxAmount) * 0.8
    return { backgroundColor: `rgba(225, 29, 72, ${intensity})` }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-4 font-medium text-slate-700">카테고리별 월간 히트맵</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="p-2 text-left text-slate-500">대분류</th>
              {months.map((month) => (
                <th key={month} className="p-2 text-slate-500">
                  {month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category}>
                <td className="whitespace-nowrap p-2 font-medium text-slate-700">{category}</td>
                {months.map((month) => {
                  const value = amounts[category]?.[month] ?? 0
                  return (
                    <td key={month} className="p-2 text-center" style={cellStyle(value)} title={formatKRW(value)}>
                      {value > 0 ? formatKRW(value) : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into `DashboardPage`**

```tsx
import CategoryHeatmap from '../components/dashboard/CategoryHeatmap'
```

```tsx
<div className="mt-6">
  <CategoryHeatmap transactions={transactions.filter((t) => selectedMonths.includes(t.date.slice(0, 7)))} />
</div>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open `/`, confirm the heatmap table renders with categories as rows, months as columns, and darker cell shading for higher spending.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/CategoryHeatmap.tsx src/pages/DashboardPage.tsx
git commit -m "feat: category-by-month spending heatmap UI"
```

---

### Task 9: Top merchants + payment method pie, final Dashboard wiring

**Files:**
- Create: `src/components/dashboard/TopMerchants.tsx`
- Create: `src/components/dashboard/PaymentMethodPie.tsx`
- Modify: `src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `topMerchants`, `paymentMethodBreakdown`, `AmountBreakdownItem` (`src/lib/dashboardAggregations.ts`), `formatKRW` (`src/lib/format.ts`).
- Produces: `TopMerchants`, `PaymentMethodPie` components — this task completes `DashboardPage`.

- [ ] **Step 1: Create `src/components/dashboard/TopMerchants.tsx`**

```tsx
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { topMerchants } from '../../lib/dashboardAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface TopMerchantsProps {
  transactions: Transaction[]
}

export default function TopMerchants({ transactions }: TopMerchantsProps) {
  const items = topMerchants(transactions, 10)

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-4 font-medium text-slate-700">Top 10 가맹점</p>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={items} layout="vertical" margin={{ left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" tickFormatter={(v) => formatKRW(v)} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={100} />
          <Tooltip formatter={(value: number) => formatKRW(value)} />
          <Bar dataKey="amount" fill="#e11d48" barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/dashboard/PaymentMethodPie.tsx`**

```tsx
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { paymentMethodBreakdown } from '../../lib/dashboardAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

const COLORS = ['#2563eb', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d']

interface PaymentMethodPieProps {
  transactions: Transaction[]
}

export default function PaymentMethodPie({ transactions }: PaymentMethodPieProps) {
  const items = paymentMethodBreakdown(transactions).slice(0, 8)

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-4 font-medium text-slate-700">결제수단별 지출 비중</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={items} dataKey="amount" nameKey="label" outerRadius={90} label={(entry) => entry.label}>
            {items.map((item, i) => (
              <Cell key={item.label} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => formatKRW(value)} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 3: Wire both into `DashboardPage`, replacing the single-column grid from Task 7**

In `src/pages/DashboardPage.tsx`, add the imports:

```tsx
import TopMerchants from '../components/dashboard/TopMerchants'
import PaymentMethodPie from '../components/dashboard/PaymentMethodPie'
```

Add a memoized `periodTransactions` value next to the other `useMemo` calls:

```tsx
const periodTransactions = useMemo(
  () => transactions.filter((t) => selectedMonths.includes(t.date.slice(0, 7))),
  [transactions, selectedMonths]
)
```

Replace the JSX block Task 7 added:

```tsx
<div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
  <CategoryDonut transactions={transactions.filter((t) => selectedMonths.includes(t.date.slice(0, 7)))} />
</div>
```

and the JSX block Task 8 added:

```tsx
<div className="mt-6">
  <CategoryHeatmap transactions={transactions.filter((t) => selectedMonths.includes(t.date.slice(0, 7)))} />
</div>
```

with this combined block (donut + heatmap now read from `periodTransactions`, plus the two new widgets):

```tsx
<div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
  <CategoryDonut transactions={periodTransactions} />
  <PaymentMethodPie transactions={periodTransactions} />
</div>

<div className="mt-6">
  <CategoryHeatmap transactions={periodTransactions} />
</div>

<div className="mt-6">
  <TopMerchants transactions={periodTransactions} />
</div>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual check**

Run: `npm run dev`, open `/`, confirm the full Dashboard renders top-to-bottom: period selector, KPI cards, monthly trend chart, category donut, category heatmap, top merchants bar chart, payment method pie — all populated with real data from the imported transactions.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/TopMerchants.tsx src/components/dashboard/PaymentMethodPie.tsx src/pages/DashboardPage.tsx
git commit -m "feat: top merchants and payment-method widgets, complete dashboard page"
```

---

### Task 10: Daily summaries + weekly spending bands

**Files:**
- Create: `src/lib/monthDetailAggregations.ts`
- Test: `src/lib/monthDetailAggregations.test.ts`

**Interfaces:**
- Consumes: `Transaction`, `resolvedFlowType` (`src/lib/aggregations.ts`).
- Produces: `DailySummary`, `dailySummaries(transactions, month): DailySummary[]`, `WeeklyBand`, `weeklySpendingBands(transactions, month): WeeklyBand[]` — consumed by Task 11 (spending pace), Task 12 (infographics), Task 13 (calendar UI).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { dailySummaries, weeklySpendingBands } from './monthDetailAggregations'
import type { Transaction } from '../types/transaction'

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'id',
    date: '2026-07-01',
    time: '00:00:00',
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

describe('dailySummaries', () => {
  it('produces one entry per calendar day in the month, zero-filled where no transactions exist', () => {
    const txs = [tx({ date: '2026-06-05', amount: -10000 })]
    const result = dailySummaries(txs, '2026-06')
    expect(result).toHaveLength(30)
    expect(result[0]).toEqual({ date: '2026-06-01', income: 0, spending: 0 })
    expect(result[4]).toEqual({ date: '2026-06-05', income: 0, spending: 10000 })
  })

  it('sums income and spending separately using resolvedFlowType', () => {
    const txs = [
      tx({ date: '2026-06-10', amount: 3000000, flowType: 'income', type: '수입' }),
      tx({ date: '2026-06-10', amount: -20000, flowType: 'spending' }),
      tx({ date: '2026-06-10', amount: -5000, flowType: 'neutral', type: '이체' }),
    ]
    const result = dailySummaries(txs, '2026-06')
    expect(result[9]).toEqual({ date: '2026-06-10', income: 3000000, spending: 20000 })
  })

  it('ignores transactions outside the requested month', () => {
    const txs = [tx({ date: '2026-07-01', amount: -10000 })]
    const result = dailySummaries(txs, '2026-06')
    expect(result.every((d) => d.spending === 0)).toBe(true)
  })
})

describe('weeklySpendingBands', () => {
  it('splits a month starting on Monday into full weeks plus one partial trailing week', () => {
    // 2026-06-01 is a Monday, 2026-06-30 is a Tuesday (30 days total)
    const txs = [tx({ date: '2026-06-01', amount: -7000 }), tx({ date: '2026-06-29', amount: -3000 })]
    const bands = weeklySpendingBands(txs, '2026-06')
    expect(bands).toHaveLength(5)
    expect(bands[0]).toEqual({ weekIndex: 0, startDate: '2026-06-01', endDate: '2026-06-07', total: 7000, isPartial: false })
    expect(bands[4]).toEqual({ weekIndex: 4, startDate: '2026-06-29', endDate: '2026-06-30', total: 3000, isPartial: true })
  })

  it('starts with a partial week when the month does not begin on a Monday', () => {
    // 2026-07-01 is a Wednesday, 2026-07-31 is a Friday (31 days total)
    const txs: Transaction[] = []
    const bands = weeklySpendingBands(txs, '2026-07')
    expect(bands).toHaveLength(5)
    expect(bands[0]).toEqual({ weekIndex: 0, startDate: '2026-07-01', endDate: '2026-07-05', total: 0, isPartial: true })
    expect(bands[4]).toEqual({ weekIndex: 4, startDate: '2026-07-27', endDate: '2026-07-31', total: 0, isPartial: true })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- monthDetailAggregations`
Expected: FAIL — `Cannot find module './monthDetailAggregations'`

- [ ] **Step 3: Implement**

```ts
import type { Transaction } from '../types/transaction'
import { resolvedFlowType } from './aggregations'

export interface DailySummary {
  date: string
  income: number
  spending: number
}

export function dailySummaries(transactions: Transaction[], month: string): DailySummary[] {
  const [year, monthNum] = month.split('-').map(Number)
  const daysInMonth = new Date(year, monthNum, 0).getDate()

  const buckets = new Map<string, { income: number; spending: number }>()
  for (let day = 1; day <= daysInMonth; day++) {
    buckets.set(`${month}-${String(day).padStart(2, '0')}`, { income: 0, spending: 0 })
  }

  for (const t of transactions) {
    const bucket = buckets.get(t.date)
    if (!bucket) continue
    const flow = resolvedFlowType(t)
    if (flow === 'income') bucket.income += t.amount
    else if (flow === 'spending') bucket.spending += t.amount
  }

  return [...buckets.entries()]
    .map(([date, b]) => ({ date, income: b.income, spending: Math.max(0, -b.spending) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface WeeklyBand {
  weekIndex: number
  startDate: string
  endDate: string
  total: number
  isPartial: boolean
}

export function weeklySpendingBands(transactions: Transaction[], month: string): WeeklyBand[] {
  const daily = dailySummaries(transactions, month)
  const bands: WeeklyBand[] = []
  let current: string[] = []
  let currentTotal = 0
  let weekIndex = 0

  function flush() {
    if (current.length === 0) return
    bands.push({
      weekIndex,
      startDate: current[0],
      endDate: current[current.length - 1],
      total: currentTotal,
      isPartial: current.length < 7,
    })
    weekIndex++
    current = []
    currentTotal = 0
  }

  for (const day of daily) {
    const dayOfWeek = new Date(`${day.date}T00:00:00`).getDay() // 0=Sun..6=Sat
    const isMonday = dayOfWeek === 1
    if (isMonday && current.length > 0) flush()
    current.push(day.date)
    currentTotal += day.spending
  }
  flush()

  return bands
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- monthDetailAggregations`
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/monthDetailAggregations.ts src/lib/monthDetailAggregations.test.ts
git commit -m "feat: daily summaries and Monday-start weekly spending bands"
```

---

### Task 11: Spending pace series

**Files:**
- Modify: `src/lib/monthDetailAggregations.ts`
- Test: `src/lib/monthDetailAggregations.test.ts`

**Interfaces:**
- Produces: `SpendingPacePoint`, `SpendingPaceResult`, `spendingPaceSeries(transactions, month, asOfDay): SpendingPaceResult` — consumed by Task 15 (spending pace chart UI).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/monthDetailAggregations.test.ts`:

```ts
describe('spendingPaceSeries', () => {
  it('accumulates this-month spending up to asOfDay and projects the remainder at the current daily rate', () => {
    const txs = [
      tx({ date: '2026-06-01', amount: -10000 }),
      tx({ date: '2026-06-02', amount: -10000 }),
    ]
    const result = spendingPaceSeries(txs, '2026-06', 2)
    expect(result.asOfDay).toBe(2)
    expect(result.points[0].thisMonth).toBe(10000)
    expect(result.points[1].thisMonth).toBe(20000)
    expect(result.points[1].thisMonthProjected).toBe(20000)
    // daily rate = 20000/2 = 10000/day; 30-day month -> projected total 300000
    expect(result.points[29].thisMonthProjected).toBe(300000)
    expect(result.points[2].thisMonth).toBeNull()
    expect(result.projectedMonthEndTotal).toBe(300000)
  })

  it('computes percent vs last month at the same day-of-month', () => {
    const txs = [
      tx({ date: '2026-06-01', amount: -20000 }),
      tx({ date: '2026-05-01', amount: -10000 }),
    ]
    const result = spendingPaceSeries(txs, '2026-06', 1)
    expect(result.points[0].lastMonth).toBe(10000)
    expect(result.percentVsLastMonthSameDay).toBeCloseTo(1) // (20000-10000)/10000
  })

  it('returns null percentVsLastMonthSameDay when last month has no data at that day', () => {
    const txs = [tx({ date: '2026-06-01', amount: -20000 })]
    const result = spendingPaceSeries(txs, '2026-06', 1)
    expect(result.percentVsLastMonthSameDay).toBeNull()
  })
})
```

Update the import at the top of the test file:

```ts
import { dailySummaries, spendingPaceSeries, weeklySpendingBands } from './monthDetailAggregations'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- monthDetailAggregations`
Expected: FAIL — `spendingPaceSeries is not a function`

- [ ] **Step 3: Implement**

Append to `src/lib/monthDetailAggregations.ts`:

```ts
export interface SpendingPacePoint {
  day: number
  thisMonth: number | null
  thisMonthProjected: number | null
  lastMonth: number | null
  threeMonthAvg: number | null
}

export interface SpendingPaceResult {
  points: SpendingPacePoint[]
  asOfDay: number
  projectedMonthEndTotal: number
  percentVsLastMonthSameDay: number | null
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function spendingPaceSeries(transactions: Transaction[], month: string, asOfDay: number): SpendingPaceResult {
  const daily = dailySummaries(transactions, month)
  const daysInMonth = daily.length

  const prevDaily = dailySummaries(transactions, shiftMonth(month, -1))
  const avgMonthsDaily = [1, 2, 3].map((n) => dailySummaries(transactions, shiftMonth(month, -n)))

  const points: SpendingPacePoint[] = []
  let thisCum = 0
  let lastCum = 0
  const avgCums = [0, 0, 0]

  const maxDay = Math.max(daysInMonth, prevDaily.length, ...avgMonthsDaily.map((d) => d.length))

  for (let day = 1; day <= maxDay; day++) {
    if (day <= daysInMonth) thisCum += daily[day - 1].spending
    if (day <= prevDaily.length) lastCum += prevDaily[day - 1].spending

    let avgSum = 0
    let avgCount = 0
    avgMonthsDaily.forEach((d, i) => {
      if (day <= d.length) {
        avgCums[i] += d[day - 1].spending
        avgSum += avgCums[i]
        avgCount++
      }
    })

    points.push({
      day,
      thisMonth: day <= asOfDay && day <= daysInMonth ? thisCum : null,
      thisMonthProjected: null,
      lastMonth: day <= prevDaily.length ? lastCum : null,
      threeMonthAvg: avgCount > 0 ? avgSum / avgCount : null,
    })
  }

  const atAsOf = points[Math.min(asOfDay, daysInMonth) - 1]?.thisMonth ?? 0
  const dailyRate = asOfDay > 0 ? atAsOf / asOfDay : 0
  for (let day = asOfDay; day <= daysInMonth; day++) {
    points[day - 1].thisMonthProjected = dailyRate * day
  }
  const projectedMonthEndTotal = dailyRate * daysInMonth

  const lastMonthAtAsOf = asOfDay <= prevDaily.length ? points[asOfDay - 1]?.lastMonth ?? null : null
  const percentVsLastMonthSameDay =
    lastMonthAtAsOf !== null && lastMonthAtAsOf !== 0 ? (atAsOf - lastMonthAtAsOf) / lastMonthAtAsOf : null

  return { points, asOfDay, projectedMonthEndTotal, percentVsLastMonthSameDay }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- monthDetailAggregations`
Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/monthDetailAggregations.ts src/lib/monthDetailAggregations.test.ts
git commit -m "feat: spending pace series with month-end projection"
```

---

### Task 12: Month infographics aggregation

**Files:**
- Modify: `src/lib/monthDetailAggregations.ts`
- Test: `src/lib/monthDetailAggregations.test.ts`

**Interfaces:**
- Produces: `MonthInfographics`, `monthInfographics(transactions, month): MonthInfographics` — consumed by Task 16 (infographic widget cards).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/monthDetailAggregations.test.ts`:

```ts
describe('monthInfographics', () => {
  it('computes the biggest spend day, delivery/coffee totals, daily average, most frequent merchant, and no-spend days', () => {
    const txs = [
      tx({ date: '2026-06-01', amount: -50000, category: '식비', subcategory: '배달', content: '배달의민족' }),
      tx({ date: '2026-06-01', amount: -5000, category: '카페/간식', subcategory: '커피/음료', content: '스타벅스' }),
      tx({ date: '2026-06-02', amount: -3000, category: '카페/간식', subcategory: '커피/음료', content: '스타벅스' }),
      tx({ date: '2026-06-03', amount: -3000, category: '카페/간식', subcategory: '커피/음료', content: '스타벅스' }),
    ]
    const result = monthInfographics(txs, '2026-06')
    expect(result.biggestSpendDay).toEqual({ date: '2026-06-01', amount: 55000 })
    expect(result.deliveryCount).toBe(1)
    expect(result.deliveryTotal).toBe(50000)
    expect(result.coffeeTotal).toBe(11000)
    expect(result.mostFrequentMerchant).toEqual({ content: '스타벅스', count: 3 })
    expect(result.noSpendDayCount).toBe(27) // 30 days in June, 3 days with spending
  })

  it('returns null biggestSpendDay/mostFrequentMerchant when there is no spending at all', () => {
    const result = monthInfographics([], '2026-06')
    expect(result.biggestSpendDay).toBeNull()
    expect(result.mostFrequentMerchant).toBeNull()
    expect(result.noSpendDayCount).toBe(30)
  })
})
```

Update the import at the top of the test file:

```ts
import { dailySummaries, monthInfographics, spendingPaceSeries, weeklySpendingBands } from './monthDetailAggregations'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- monthDetailAggregations`
Expected: FAIL — `monthInfographics is not a function`

- [ ] **Step 3: Implement**

Append to `src/lib/monthDetailAggregations.ts`:

```ts
export interface MonthInfographics {
  biggestSpendDay: { date: string; amount: number } | null
  deliveryCount: number
  deliveryTotal: number
  coffeeTotal: number
  dailyAverageSpending: number
  mostFrequentMerchant: { content: string; count: number } | null
  noSpendDayCount: number
}

export function monthInfographics(transactions: Transaction[], month: string): MonthInfographics {
  const daily = dailySummaries(transactions, month)
  const monthSpendingTx = transactions.filter((t) => t.date.slice(0, 7) === month && resolvedFlowType(t) === 'spending')

  const biggestDay = [...daily].filter((d) => d.spending > 0).sort((a, b) => b.spending - a.spending)[0]
  const totalSpending = daily.reduce((sum, d) => sum + d.spending, 0)
  const noSpendDayCount = daily.filter((d) => d.spending === 0).length

  const delivery = monthSpendingTx.filter((t) => t.subcategory === '배달')
  const deliveryTotal = delivery.reduce((sum, t) => sum + Math.max(0, -t.amount), 0)

  const coffeeTotal = monthSpendingTx
    .filter((t) => t.subcategory === '커피/음료')
    .reduce((sum, t) => sum + Math.max(0, -t.amount), 0)

  const merchantCounts = new Map<string, number>()
  for (const t of monthSpendingTx) {
    merchantCounts.set(t.content, (merchantCounts.get(t.content) ?? 0) + 1)
  }
  const mostFrequentEntry = [...merchantCounts.entries()].sort((a, b) => b[1] - a[1])[0]

  return {
    biggestSpendDay: biggestDay ? { date: biggestDay.date, amount: biggestDay.spending } : null,
    deliveryCount: delivery.length,
    deliveryTotal,
    coffeeTotal,
    dailyAverageSpending: daily.length > 0 ? totalSpending / daily.length : 0,
    mostFrequentMerchant: mostFrequentEntry ? { content: mostFrequentEntry[0], count: mostFrequentEntry[1] } : null,
    noSpendDayCount,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- monthDetailAggregations`
Expected: `11 passed` (this count reflects the extra regression test added by Task 11's post-review fix — see progress ledger)

- [ ] **Step 5: Run the full test suite**

Run: `npm run test`
Expected: all suites pass (idHash, format, excelParser, categories, transferMatching, classification, aggregations, dashboardAggregations, monthDetailAggregations).

- [ ] **Step 6: Commit**

```bash
git add src/lib/monthDetailAggregations.ts src/lib/monthDetailAggregations.test.ts
git commit -m "feat: month infographics aggregation (biggest day, delivery/coffee totals, no-spend days)"
```

---

### Task 13: Month navigation shell + calendar grid with weekly bands

**Files:**
- Create: `src/pages/MonthDetailPage.tsx`
- Create: `src/components/month/CalendarGrid.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useTransactionStore` (Task 12 foundation), `dailySummaries`, `weeklySpendingBands` (Task 10), `formatKRW`, `formatManwon` (`src/lib/format.ts`), `useParams`/`useNavigate` (react-router-dom).
- Produces: `MonthDetailPage` mounted at `/month/:yyyyMm`, `CalendarGrid` component with an `onDayClick` callback — consumed by Task 14 (day panel).

No test file (page/calendar UI composition).

- [ ] **Step 1: Create `src/components/month/CalendarGrid.tsx`**

```tsx
import { useMemo } from 'react'
import { dailySummaries, weeklySpendingBands } from '../../lib/monthDetailAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface CalendarGridProps {
  transactions: Transaction[]
  month: string
  onDayClick: (date: string) => void
}

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

export default function CalendarGrid({ transactions, month, onDayClick }: CalendarGridProps) {
  const daily = useMemo(() => dailySummaries(transactions, month), [transactions, month])
  const bands = useMemo(() => weeklySpendingBands(transactions, month), [transactions, month])

  const avgWeeklyTotal = useMemo(() => {
    if (bands.length === 0) return 0
    return bands.reduce((sum, b) => sum + b.total, 0) / bands.length
  }, [bands])

  const maxSpending = useMemo(() => Math.max(1, ...daily.map((d) => d.spending)), [daily])

  const firstDayOffset = useMemo(() => {
    if (daily.length === 0) return 0
    const dow = new Date(`${daily[0].date}T00:00:00`).getDay()
    return dow === 0 ? 6 : dow - 1 // Monday-start offset
  }, [daily])

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-3 grid grid-cols-7 text-center text-xs font-medium text-slate-500">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>
      {bands.map((band) => {
        const bandDays = daily.filter((d) => d.date >= band.startDate && d.date <= band.endDate)
        const delta = avgWeeklyTotal > 0 ? ((band.total - avgWeeklyTotal) / avgWeeklyTotal) * 100 : 0

        return (
          <div key={band.weekIndex} className="relative mb-1 rounded-lg" style={{ backgroundColor: 'rgba(37, 99, 235, 0.08)' }}>
            <div className="grid grid-cols-7 gap-1 p-1">
              {band.weekIndex === 0 &&
                Array.from({ length: firstDayOffset }).map((_, i) => <div key={`empty-${i}`} />)}
              {bandDays.map((day) => {
                const intensity = day.spending > 0 ? 0.1 + (day.spending / maxSpending) * 0.5 : 0
                return (
                  <button
                    key={day.date}
                    onClick={() => onDayClick(day.date)}
                    className="rounded-md p-2 text-left text-xs hover:ring-2 hover:ring-blue-300"
                    style={{ backgroundColor: intensity > 0 ? `rgba(225, 29, 72, ${intensity})` : 'transparent' }}
                  >
                    <div className="font-medium text-slate-700">{Number(day.date.slice(-2))}</div>
                    {day.income > 0 && <div className="text-blue-600">+{formatKRW(day.income)}</div>}
                    {day.spending > 0 && <div className="text-rose-600">-{formatKRW(day.spending)}</div>}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between px-2 pb-1 text-xs text-slate-500">
              <span>
                {band.weekIndex + 1}주차 · 지출 {formatKRW(band.total)}
                {band.isPartial && <span className="ml-1 rounded bg-slate-200 px-1 text-slate-500">부분 주</span>}
              </span>
              {avgWeeklyTotal > 0 && (
                <span className={delta >= 0 ? 'text-rose-600' : 'text-emerald-600'}>
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/pages/MonthDetailPage.tsx`**

```tsx
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CalendarGrid from '../components/month/CalendarGrid'
import { useTransactionStore } from '../store/useTransactionStore'
import { listAvailableMonths } from '../lib/aggregations'

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function MonthDetailPage() {
  const { yyyyMm } = useParams<{ yyyyMm: string }>()
  const navigate = useNavigate()
  const transactions = useTransactionStore((s) => s.transactions)
  const availableMonths = useMemo(() => listAvailableMonths(transactions), [transactions])

  const month = yyyyMm ?? availableMonths[availableMonths.length - 1] ?? new Date().toISOString().slice(0, 7)

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate(`/month/${shiftMonth(month, -1)}`)} className="rounded-lg bg-white px-3 py-1.5 text-slate-600 shadow-sm">
          ← 이전 달
        </button>
        <select value={month} onChange={(e) => navigate(`/month/${e.target.value}`)} className="rounded-lg border px-3 py-1.5 text-lg font-bold text-slate-800">
          {availableMonths.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button onClick={() => navigate(`/month/${shiftMonth(month, 1)}`)} className="rounded-lg bg-white px-3 py-1.5 text-slate-600 shadow-sm">
          다음 달 →
        </button>
      </div>

      <CalendarGrid transactions={transactions} month={month} onDayClick={() => {}} />
    </div>
  )
}
```

- [ ] **Step 3: Wire into `src/App.tsx`**

Replace `MonthDetailPlaceholder` and its route:

```tsx
import MonthDetailPage from './pages/MonthDetailPage'
```

```tsx
<Route path="/month/:yyyyMm" element={<MonthDetailPage />} />
```

Remove the now-unused `MonthDetailPlaceholder` function definition.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual check**

Run: `npm run dev`, click into `/month/2026-07` from the Dashboard trend chart (or via the URL), confirm the calendar renders with correct weekday alignment (Monday first column), daily income/spending mini-labels, weekly bands with totals and partial-week badges, and the month dropdown/arrows navigate correctly.

- [ ] **Step 6: Commit**

```bash
git add src/pages/MonthDetailPage.tsx src/components/month/CalendarGrid.tsx src/App.tsx
git commit -m "feat: month detail page with calendar grid and weekly spending bands"
```

---

### Task 14: Day transaction panel (read-only)

**Files:**
- Create: `src/components/month/DayTransactionPanel.tsx`
- Modify: `src/pages/MonthDetailPage.tsx`

**Interfaces:**
- Consumes: `Transaction`, `formatKRW` (`src/lib/format.ts`).
- Produces: `DayTransactionPanel` component — consumed only by `MonthDetailPage`.

Per this plan's Global Constraints, this panel is **view-only** — no add/edit/delete controls. Full editing is out of scope (Phase 4).

- [ ] **Step 1: Create `src/components/month/DayTransactionPanel.tsx`**

```tsx
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface DayTransactionPanelProps {
  date: string
  transactions: Transaction[]
  onClose: () => void
}

export default function DayTransactionPanel({ date, transactions, onClose }: DayTransactionPanelProps) {
  const dayTransactions = transactions.filter((t) => t.date === date).sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className="fixed inset-y-0 right-0 z-20 w-full max-w-sm overflow-y-auto bg-white p-6 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-lg font-bold text-slate-800">{date}</p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
          ✕
        </button>
      </div>
      {dayTransactions.length === 0 ? (
        <p className="text-sm text-slate-400">이 날짜에는 거래가 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {dayTransactions.map((t) => (
            <li key={t.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">{t.content}</span>
                <span className={t.amount < 0 ? 'text-rose-600' : 'text-blue-600'}>{formatKRW(t.amount)}</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {t.time.slice(0, 5)} · {t.category} / {t.subcategory} · {t.paymentMethod}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire into `MonthDetailPage`**

In `src/pages/MonthDetailPage.tsx`:

```tsx
import { useState } from 'react'
import DayTransactionPanel from '../components/month/DayTransactionPanel'
```

```tsx
const [selectedDay, setSelectedDay] = useState<string | null>(null)
```

Replace `onDayClick={() => {}}` with `onDayClick={setSelectedDay}`, and add after `<CalendarGrid ... />`:

```tsx
{selectedDay && (
  <DayTransactionPanel date={selectedDay} transactions={transactions} onClose={() => setSelectedDay(null)} />
)}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open a month detail page, click a day with transactions, confirm a right-side panel lists that day's transactions (content, amount, time, category, payment method) and closes via the ✕ button.

- [ ] **Step 5: Commit**

```bash
git add src/components/month/DayTransactionPanel.tsx src/pages/MonthDetailPage.tsx
git commit -m "feat: read-only day transaction panel on month detail calendar"
```

---

### Task 15: Spending pace chart

**Files:**
- Create: `src/components/month/SpendingPaceChart.tsx`
- Modify: `src/pages/MonthDetailPage.tsx`

**Interfaces:**
- Consumes: `spendingPaceSeries`, `SpendingPaceResult` (`src/lib/monthDetailAggregations.ts`), `formatKRW` (`src/lib/format.ts`).
- Produces: `SpendingPaceChart` component — consumed only by `MonthDetailPage`.

- [ ] **Step 1: Create `src/components/month/SpendingPaceChart.tsx`**

```tsx
import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { spendingPaceSeries } from '../../lib/monthDetailAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface SpendingPaceChartProps {
  transactions: Transaction[]
  month: string
}

export default function SpendingPaceChart({ transactions, month }: SpendingPaceChartProps) {
  const isCurrentMonth = month === new Date().toISOString().slice(0, 7)
  const asOfDay = isCurrentMonth ? new Date().getDate() : 31

  const result = useMemo(() => spendingPaceSeries(transactions, month, asOfDay), [transactions, month, asOfDay])
  const clampedAsOfDay = Math.min(asOfDay, result.points.length)

  const isFaster = (result.percentVsLastMonthSameDay ?? 0) > 0

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-1 font-medium text-slate-700">지출 속도 (Spending Pace)</p>
      <p className={`mb-4 text-sm font-medium ${isFaster ? 'text-rose-600' : 'text-emerald-600'}`}>
        {result.percentVsLastMonthSameDay === null
          ? '비교할 지난달 데이터가 없습니다.'
          : `지난달 같은 날 대비 ${isFaster ? '+' : ''}${(result.percentVsLastMonthSameDay * 100).toFixed(0)}% ${
              isFaster ? '빠름' : '느림'
            } · 이 속도면 월말 예상 ${formatKRW(Math.round(result.projectedMonthEndTotal))}`}
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={result.points}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v) => formatKRW(v)} tick={{ fontSize: 11 }} width={80} />
          <Tooltip
            formatter={(value: number | null) => (value === null ? '-' : formatKRW(value))}
            labelFormatter={(day) => `${day}일`}
          />
          <Line type="monotone" dataKey="threeMonthAvg" name="최근 3개월 평균" stroke="#cbd5e1" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="lastMonth" name="지난달" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          <Line type="monotone" dataKey="thisMonth" name="이번 달" stroke="#e11d48" strokeWidth={2.5} dot={false} />
          <Line
            type="monotone"
            dataKey="thisMonthProjected"
            name="이번 달 예상"
            stroke="#e11d48"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-slate-400">{clampedAsOfDay}일까지 실제 데이터, 이후는 현재 속도 기준 예상치입니다.</p>
    </div>
  )
}
```

- [ ] **Step 2: Wire into `MonthDetailPage`**

```tsx
import SpendingPaceChart from '../components/month/SpendingPaceChart'
```

```tsx
<div className="mt-6">
  <SpendingPaceChart transactions={transactions} month={month} />
</div>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open a month detail page, confirm the pace chart renders 3-4 lines (this month solid, this month projected dashed, last month dashed gray, 3-month average light) and the summary line above shows a percent comparison and projected total.

- [ ] **Step 5: Commit**

```bash
git add src/components/month/SpendingPaceChart.tsx src/pages/MonthDetailPage.tsx
git commit -m "feat: spending pace line chart with month-end projection"
```

---

### Task 16: Month summary, category breakdown, infographics — complete Month Detail page

**Files:**
- Create: `src/components/month/MonthSummaryCard.tsx`
- Create: `src/components/month/MonthInfographics.tsx`
- Modify: `src/pages/MonthDetailPage.tsx`

**Interfaces:**
- Consumes: `summarizeByMonth`, `monthOverMonthChange` (`src/lib/aggregations.ts`), `monthInfographics` (`src/lib/monthDetailAggregations.ts`), `CategoryDonut` (Task 7, reused as-is), `formatKRW` (`src/lib/format.ts`).
- Produces: complete `MonthDetailPage` — this is the final task of this plan.

- [ ] **Step 1: Create `src/components/month/MonthSummaryCard.tsx`**

```tsx
import { formatKRW } from '../../lib/format'
import { monthOverMonthChange, type MonthlySummary } from '../../lib/aggregations'

interface MonthSummaryCardProps {
  current: MonthlySummary | undefined
  previous: MonthlySummary | undefined
}

export default function MonthSummaryCard({ current, previous }: MonthSummaryCardProps) {
  if (!current) {
    return <div className="rounded-xl bg-white p-6 shadow-sm text-sm text-slate-400">이 달에는 거래가 없습니다.</div>
  }

  const netSaving = current.income - current.spending
  const netChange = previous ? monthOverMonthChange(netSaving, previous.income - previous.spending) : null

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-4 font-medium text-slate-700">이 달 요약</p>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-slate-500">수입</p>
          <p className="text-lg font-bold text-blue-600">{formatKRW(current.income)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">지출</p>
          <p className="text-lg font-bold text-rose-600">{formatKRW(current.spending)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">순저축</p>
          <p className="text-lg font-bold text-emerald-600">
            {formatKRW(netSaving)}
            {netChange !== null && (
              <span className={`ml-1 text-xs ${netChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                ({netChange >= 0 ? '+' : ''}
                {(netChange * 100).toFixed(0)}%)
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/month/MonthInfographics.tsx`**

```tsx
import { monthInfographics } from '../../lib/monthDetailAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface MonthInfographicsProps {
  transactions: Transaction[]
  month: string
}

export default function MonthInfographics({ transactions, month }: MonthInfographicsProps) {
  const info = monthInfographics(transactions, month)

  const cards = [
    {
      label: '이번 달 가장 많이 쓴 날',
      value: info.biggestSpendDay ? `${info.biggestSpendDay.date.slice(-2)}일 · ${formatKRW(info.biggestSpendDay.amount)}` : '-',
    },
    { label: '배달', value: `${info.deliveryCount}번 · ${formatKRW(info.deliveryTotal)}` },
    { label: '커피 지출', value: formatKRW(info.coffeeTotal) },
    { label: '하루 평균 지출', value: formatKRW(Math.round(info.dailyAverageSpending)) },
    {
      label: '가장 자주 간 가맹점',
      value: info.mostFrequentMerchant ? `${info.mostFrequentMerchant.content} (${info.mostFrequentMerchant.count}회)` : '-',
    },
    { label: '무지출 데이', value: `${info.noSpendDayCount}일` },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">{card.label}</p>
          <p className="mt-1 text-sm font-bold text-slate-800">{card.value}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Wire everything into `MonthDetailPage`**

Modify `src/pages/MonthDetailPage.tsx` to add the summary card, category breakdown (reusing `CategoryDonut` from Task 7, scoped to this month's transactions, spending-only by construction), and infographics:

```tsx
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CalendarGrid from '../components/month/CalendarGrid'
import DayTransactionPanel from '../components/month/DayTransactionPanel'
import SpendingPaceChart from '../components/month/SpendingPaceChart'
import MonthSummaryCard from '../components/month/MonthSummaryCard'
import MonthInfographics from '../components/month/MonthInfographics'
import CategoryDonut from '../components/dashboard/CategoryDonut'
import { useTransactionStore } from '../store/useTransactionStore'
import { listAvailableMonths, summarizeByMonth } from '../lib/aggregations'

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function MonthDetailPage() {
  const { yyyyMm } = useParams<{ yyyyMm: string }>()
  const navigate = useNavigate()
  const transactions = useTransactionStore((s) => s.transactions)
  const availableMonths = useMemo(() => listAvailableMonths(transactions), [transactions])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const month = yyyyMm ?? availableMonths[availableMonths.length - 1] ?? new Date().toISOString().slice(0, 7)

  const summaries = useMemo(() => summarizeByMonth(transactions), [transactions])
  const currentSummary = summaries.find((s) => s.month === month)
  const previousSummary = summaries.find((s) => s.month === shiftMonth(month, -1))

  const monthTransactions = useMemo(() => transactions.filter((t) => t.date.slice(0, 7) === month), [transactions, month])

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate(`/month/${shiftMonth(month, -1)}`)} className="rounded-lg bg-white px-3 py-1.5 text-slate-600 shadow-sm">
          ← 이전 달
        </button>
        <select value={month} onChange={(e) => navigate(`/month/${e.target.value}`)} className="rounded-lg border px-3 py-1.5 text-lg font-bold text-slate-800">
          {availableMonths.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button onClick={() => navigate(`/month/${shiftMonth(month, 1)}`)} className="rounded-lg bg-white px-3 py-1.5 text-slate-600 shadow-sm">
          다음 달 →
        </button>
      </div>

      <div className="mb-6">
        <MonthSummaryCard current={currentSummary} previous={previousSummary} />
      </div>

      <CalendarGrid transactions={transactions} month={month} onDayClick={setSelectedDay} />

      <div className="mt-6">
        <SpendingPaceChart transactions={transactions} month={month} />
      </div>

      <div className="mt-6">
        <CategoryDonut transactions={monthTransactions} />
      </div>

      <div className="mt-6">
        <MonthInfographics transactions={transactions} month={month} />
      </div>

      {selectedDay && (
        <DayTransactionPanel date={selectedDay} transactions={transactions} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the full test suite**

Run: `npm run test`
Expected: all suites pass (9 test files, matching Task 12's list plus no new test files in Tasks 13-16 since they're UI-only).

- [ ] **Step 6: Manual end-to-end check**

Run: `npm run dev`, navigate to a month with real imported data. Confirm, top to bottom: month nav works, month summary card shows income/spending/net saving with a previous-month delta, calendar + weekly bands render correctly, day click opens the read-only transaction panel, spending pace chart renders with a sensible summary line, category donut shows this month's spending breakdown with drill-down, and the 6 infographic cards show real values (biggest spend day, delivery, coffee, daily average, top merchant, no-spend days).

- [ ] **Step 7: Commit**

```bash
git add src/components/month/MonthSummaryCard.tsx src/components/month/MonthInfographics.tsx src/pages/MonthDetailPage.tsx
git commit -m "feat: month summary, category breakdown, and infographics — complete month detail page"
```

---

## What's next (not in this plan)

Phase 4 (full Entries CRUD with inline editing and rule management) and Phase 5 (Vercel deploy + polish) each get their own plan, written after this one is merged and manually verified — per the design doc's section 4 ordering. The Entries page will add the add/edit/delete affordances intentionally left out of Task 14's read-only day panel.
