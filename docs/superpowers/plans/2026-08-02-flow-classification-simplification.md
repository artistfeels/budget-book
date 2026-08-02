# 저축/이체 분류 단순화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the fragile per-transaction "saving" classification (`FlowType` shrinks from `income|saving|spending|neutral` to `income|spending|neutral`); compute 저축/투자 as a monthly residual (`max(0, 수입 - 지출)`) instead of a summed transaction bucket; add a manual "이체로 제외" override so misclassified internal transfers can be excluded by hand from the 거래관리 screen, with a way to view and undo exclusions.

**Architecture:** This is a coordinated type-narrowing rename that touches every file consuming `FlowType`/`flowTypeOverride`. Tasks are grouped by file-dependency layer (types → classification → aggregation → UI) rather than being independently buildable — `npm run build` will only pass again once the final task lands (see Global Constraints). Each task's own test file is the per-task pass/fail gate instead.

**Tech Stack:** React 18 + TypeScript, Zustand, Vitest, Supabase Postgres (manual SQL migration via the Supabase dashboard's SQL Editor — no linked Supabase CLI project in this repo).

## Global Constraints

- Source spec: `docs/superpowers/specs/2026-08-02-flow-classification-simplification-design.md` — read for the full rationale; this plan implements it exactly.
- **`npm run build` will fail on every task except the last.** This is expected: `FlowType`'s literal-type narrowing breaks every consumer file simultaneously, and they can't all be edited atomically in one task without producing an unreviewably large diff. Each task instead runs `npx vitest run <specific test file(s)>` as its pass/fail gate. Do not treat a broken `npm run build` as a regression before the final task — but DO treat a broken vitest run for the files THIS task lists as a real failure.
- `FlowType`: `'income' | 'spending' | 'neutral'` (was `'income' | 'saving' | 'spending' | 'neutral'`). `Transaction.flowTypeOverride`: `'spending' | 'neutral' | null` (was `'saving' | 'spending' | null'`). `ClassificationRule.flowType`: `'spending' | 'neutral'` (was `'saving' | 'spending'`).
- `resolvedFlowType(tx)` (`src/lib/aggregations.ts`) is unchanged in shape (`tx.flowTypeOverride ?? tx.flowType`) — only the value universe it returns shrinks.
- Colors (already established, reuse exactly): 수입 = `text-blue-600`, 지출 = `text-rose-600`. The emerald/`text-emerald-600` color previously reserved for "저축" per-transaction display is retired along with the flow type — do not repurpose it in this plan.
- Git repo: commit directly to `master` after every task (established pattern for this project — no feature branch).
- No component-level tests exist in this codebase (Vitest is lib-layer TDD only); `.tsx` correctness is verified via `tsc`/`npm run build` (final task) plus a manual browser smoke test, matching the established pattern for every other `.tsx` file in this project.

---

### Task 1: Type simplification + `classification.ts`

**Files:**
- Modify: `src/types/transaction.ts`
- Modify: `src/lib/classification.ts`
- Modify: `src/lib/classification.test.ts`

**Interfaces:**
- Produces (consumed by every later task): `FlowType = 'income' | 'spending' | 'neutral'`, `Transaction.flowTypeOverride: 'spending' | 'neutral' | null'`, `ClassificationRule.flowType: 'spending' | 'neutral'`.
- `classifyFlowType(input: ClassificationInput, rules: ClassificationRule[]): FlowType` — signature unchanged, return-value universe shrinks.

- [ ] **Step 1: Update `src/types/transaction.ts`**

Change line 2 and line 17:

```ts
export type FlowType = 'income' | 'spending' | 'neutral'
```

```ts
  flowTypeOverride: 'spending' | 'neutral' | null
```

Change line 27 (`ClassificationRule.flowType`):

```ts
  flowType: 'spending' | 'neutral'
```

- [ ] **Step 2: Update the failing tests in `src/lib/classification.test.ts`**

Replace the file's `describe('classifyFlowType', ...)` block with:

```ts
describe('classifyFlowType', () => {
  it('classifies an ordinary expense as spending', () => {
    expect(classifyFlowType(base(), [])).toBe('spending')
  })

  it('classifies ordinary income as income', () => {
    const input = base({ type: '수입', category: '급여', paymentMethod: 'NH주거래우대통장', amount: 3000000 })
    expect(classifyFlowType(input, [])).toBe('income')
  })

  it('classifies a saving-account payment method as neutral regardless of type', () => {
    const input = base({ type: '이체', category: '이체', paymentMethod: '주택청약종합저축', amount: -100000 })
    expect(classifyFlowType(input, [])).toBe('neutral')
  })

  it('classifies a positive-amount (inflow) transaction on a saving-account payment method as income, not neutral', () => {
    const input = base({
      type: '수입',
      category: '환급',
      paymentMethod: '주택청약종합저축',
      amount: 500000,
    })
    expect(classifyFlowType(input, [])).toBe('income')
  })

  it('classifies an outgoing 이체>투자 as neutral', () => {
    const input = base({ type: '이체', category: '투자', paymentMethod: 'MY 입출금통장', amount: -3000000 })
    expect(classifyFlowType(input, [])).toBe('neutral')
  })

  it('classifies an incoming 이체>투자 (redemption) as neutral too — internal account movement either way', () => {
    const input = base({ type: '이체', category: '투자', paymentMethod: 'OK파킹플렉스통장', amount: 1989192 })
    expect(classifyFlowType(input, [])).toBe('neutral')
  })

  it('classifies 지출>금융>증권/투자 as neutral', () => {
    const input = base({ type: '지출', category: '금융', subcategory: '증권/투자', amount: -14260 })
    expect(classifyFlowType(input, [])).toBe('neutral')
  })

  it('classifies 이체>카드대금 as neutral', () => {
    const input = base({ type: '이체', category: '카드대금', paymentMethod: 'NH주거래우대통장', amount: -251310 })
    expect(classifyFlowType(input, [])).toBe('neutral')
  })

  it('classifies a paired internal transfer as neutral', () => {
    const input = base({ type: '이체', category: '내계좌이체', isPairedTransfer: true, amount: -120000 })
    expect(classifyFlowType(input, [])).toBe('neutral')
  })

  it('classifies an unmatched internal transfer as neutral', () => {
    const input = base({ type: '이체', category: '내계좌이체', isUnmatchedTransfer: true, amount: 20000 })
    expect(classifyFlowType(input, [])).toBe('neutral')
  })

  it('classifies any other 이체 category (e.g. 현금) as neutral', () => {
    const input = base({ type: '이체', category: '현금', amount: -50000 })
    expect(classifyFlowType(input, [])).toBe('neutral')
  })

  it('a manual override always wins over every automatic rule', () => {
    const input = base({ flowTypeOverride: 'neutral' })
    expect(classifyFlowType(input, [])).toBe('neutral')
  })

  it('a content-based user rule wins over the default spending classification', () => {
    const input = base({ content: '토스증권 자동이체' })
    const rules: ClassificationRule[] = [
      { id: 'r1', matchType: 'content', matchValue: '토스증권 자동이체', flowType: 'neutral' },
    ]
    expect(classifyFlowType(input, rules)).toBe('neutral')
  })

  it('a payment-method-based user rule wins over the default spending classification', () => {
    const input = base({ paymentMethod: '내마음대로적금' })
    const rules: ClassificationRule[] = [
      { id: 'r1', matchType: 'payment_method', matchValue: '내마음대로적금', flowType: 'neutral' },
    ]
    expect(classifyFlowType(input, rules)).toBe('neutral')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/classification.test.ts`
Expected: FAIL — `classification.ts` still returns `'saving'` in several branches, which no longer matches the updated test expectations (and `'saving'` is no longer assignable to `flowTypeOverride`/`ClassificationRule.flowType`, so this won't even compile cleanly under `tsc`, but `vitest run` uses esbuild transpilation and will still execute — the assertions themselves fail).

- [ ] **Step 4: Implement `src/lib/classification.ts`**

Replace the whole file with:

```ts
import type { ClassificationRule, FlowType, TransactionType } from '../types/transaction'

export interface ClassificationInput {
  type: TransactionType
  category: string
  subcategory: string
  content: string
  paymentMethod: string
  amount: number
  isPairedTransfer: boolean
  isUnmatchedTransfer: boolean
  flowTypeOverride: 'spending' | 'neutral' | null
}

const SAVING_PAYMENT_METHODS = ['주택청약종합저축', 'NH청년도약계좌', '월세 보증금']

export function classifyFlowType(input: ClassificationInput, rules: ClassificationRule[]): FlowType {
  if (input.flowTypeOverride) {
    return input.flowTypeOverride
  }

  const matchedRule = rules.find(
    (rule) =>
      (rule.matchType === 'content' && rule.matchValue === input.content) ||
      (rule.matchType === 'payment_method' && rule.matchValue === input.paymentMethod)
  )
  if (matchedRule) {
    return matchedRule.flowType
  }

  if (SAVING_PAYMENT_METHODS.includes(input.paymentMethod) && input.amount < 0) {
    return 'neutral'
  }

  // Internal account-to-account movement either direction — not income, not spending.
  if (input.type === '이체' && input.category === '투자') {
    return 'neutral'
  }

  if (input.type === '지출' && input.category === '금융' && input.subcategory === '증권/투자') {
    return 'neutral'
  }

  if (input.type === '이체' && input.category === '카드대금') {
    return 'neutral'
  }

  if (input.type === '이체' && input.isPairedTransfer) {
    return 'neutral'
  }

  if (input.type === '이체' && input.isUnmatchedTransfer) {
    return 'neutral'
  }

  if (input.type === '이체') {
    return 'neutral'
  }

  if (input.type === '수입') {
    return 'income'
  }

  return 'spending'
}
```

Note what changed from the prior version: the `SAVING_PAYMENT_METHODS` branch and the `지출>금융>증권/투자` branch now return `'neutral'` instead of `'saving'`; the `이체>투자` branch collapses from an amount-sign-dependent `saving`/`income` split into an unconditional `'neutral'`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/classification.test.ts`
Expected: PASS — all 14 cases green.

- [ ] **Step 6: Commit**

```bash
git add src/types/transaction.ts src/lib/classification.ts src/lib/classification.test.ts
git commit -m "refactor: retire per-transaction saving classification in favor of neutral exclusion"
```

---

### Task 2: `aggregations.ts` residual saving formula + `dashboardAggregations.ts` cleanup

**Files:**
- Modify: `src/lib/aggregations.ts`
- Modify: `src/lib/aggregations.test.ts`
- Modify: `src/lib/dashboardAggregations.ts`
- Modify: `src/lib/dashboardAggregations.test.ts`

**Interfaces:**
- Consumes: `FlowType`, `resolvedFlowType` (Task 1).
- Produces (consumed by Task 6): `MonthlySummary` shape unchanged (`{ month, income, spending, saving, netCashFlow }`) but `saving` is now `max(0, income - spending)` and `netCashFlow` is `income - spending` (unclamped).
- Produces (consumed by Task 6): `categoryBreakdown(transactions, category?)` / `subcategoryBreakdown(transactions, category, subcategory?)` lose their `includeSaving` parameter — signature becomes `categoryBreakdown(transactions: Transaction[]): AmountBreakdownItem[]` and `subcategoryBreakdown(transactions: Transaction[], category: string): AmountBreakdownItem[]`.

- [ ] **Step 1: Update `src/lib/aggregations.test.ts`**

Replace the `describe('summarizeByMonth', ...)` block with:

```ts
describe('summarizeByMonth', () => {
  it('computes saving as the residual of income minus spending for the month', () => {
    const txs = [
      tx({ date: '2026-07-05', amount: 3000000, flowType: 'income' }),
      tx({ date: '2026-07-10', amount: -50000, flowType: 'spending' }),
    ]
    const [july] = summarizeByMonth(txs)
    expect(july).toEqual({ month: '2026-07', income: 3000000, spending: 50000, saving: 2950000, netCashFlow: 2950000 })
  })

  it('nets refund rows against spending in the same category (positive-amount spending row)', () => {
    const txs = [
      tx({ date: '2026-07-10', amount: -20000, flowType: 'spending' }),
      tx({ date: '2026-07-11', amount: 2000, flowType: 'spending' }), // partial refund
    ]
    const [july] = summarizeByMonth(txs)
    expect(july.spending).toBe(18000)
  })

  it('clamps spending to 0 when refunds exceed the original outflow in a month', () => {
    const txs = [
      tx({ date: '2026-07-10', amount: -10000, flowType: 'spending' }),
      tx({ date: '2026-07-11', amount: 15000, flowType: 'spending' }), // over-refund
    ]
    const [july] = summarizeByMonth(txs)
    expect(july.spending).toBe(0)
  })

  it('excludes neutral transactions entirely', () => {
    const txs = [tx({ date: '2026-07-10', amount: -251310, flowType: 'neutral' })]
    const result = summarizeByMonth(txs)
    expect(result).toEqual([])
  })

  it('groups multiple months and sorts them chronologically', () => {
    const txs = [
      tx({ date: '2026-08-01', amount: -1000, flowType: 'spending' }),
      tx({ date: '2026-07-01', amount: -1000, flowType: 'spending' }),
    ]
    const result = summarizeByMonth(txs)
    expect(result.map((r) => r.month)).toEqual(['2026-07', '2026-08'])
  })

  it('respects a manual override when computing the bucket', () => {
    const txs = [tx({ date: '2026-07-10', amount: -50000, flowType: 'spending', flowTypeOverride: 'neutral' })]
    const [july] = summarizeByMonth(txs)
    expect(july).toBeUndefined()
  })

  it('clamps saving to 0 in an overspend month, while netCashFlow stays negative', () => {
    const txs = [
      tx({ date: '2026-07-05', amount: 1000000, flowType: 'income' }),
      tx({ date: '2026-07-10', amount: -1500000, flowType: 'spending' }),
    ]
    const [july] = summarizeByMonth(txs)
    expect(july.saving).toBe(0)
    expect(july.netCashFlow).toBe(-500000)
  })
})
```

(The old "respects a manual override" test asserted the overridden row landed in a `saving` bucket that no longer exists — the new version asserts it correctly nets out to nothing in `summarizeByMonth`'s output, since `neutral` rows are skipped entirely per the `if (flow === 'neutral') continue` line already in the function.)

- [ ] **Step 2: Update `src/lib/dashboardAggregations.test.ts`**

Replace the `describe('categoryBreakdown', ...)` block with:

```ts
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
    const txs = [tx({ category: '식비', amount: -10000, flowType: 'spending', flowTypeOverride: 'neutral' })]
    expect(categoryBreakdown(txs)).toEqual([])
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/aggregations.test.ts src/lib/dashboardAggregations.test.ts`
Expected: FAIL — old `saving`-bucket logic and `includeSaving` parameter still present.

- [ ] **Step 4: Implement `src/lib/aggregations.ts`**

Replace `summarizeByMonth`'s body (keep `resolvedFlowType`, `listAvailableMonths`, `monthOverMonthChange`, `MonthlySummary` interface unchanged) with:

```ts
export function summarizeByMonth(transactions: Transaction[]): MonthlySummary[] {
  const buckets = new Map<string, { income: number; spending: number }>()

  for (const t of transactions) {
    const flow = resolvedFlowType(t)
    if (flow === 'neutral') continue

    const month = t.date.slice(0, 7)
    if (!buckets.has(month)) {
      buckets.set(month, { income: 0, spending: 0 })
    }
    const bucket = buckets.get(month)!
    if (flow === 'income') bucket.income += t.amount
    else if (flow === 'spending') bucket.spending += t.amount
  }

  return [...buckets.entries()]
    .map(([month, bucket]) => {
      const income = bucket.income
      // Refunds net against spending, but if they outweigh the original outflow the bucket sum
      // goes positive — that's no longer "spending" in this month, so clamp at 0 instead of
      // flipping it back to a fake positive figure.
      const spending = Math.max(0, -bucket.spending)
      // Saving/투자 is no longer a classified bucket — it's whatever income wasn't consumed.
      // Clamped at 0 for display; netCashFlow below carries the unclamped (possibly negative) signal.
      const saving = Math.max(0, income - spending)
      const netCashFlow = income - spending
      return { month, income, spending, saving, netCashFlow }
    })
    .sort((a, b) => a.month.localeCompare(b.month))
}
```

- [ ] **Step 5: Implement `src/lib/dashboardAggregations.ts`**

Replace `bucketBySpending`, `categoryBreakdown`, and `subcategoryBreakdown` (keep `topMerchants`, `paymentMethodBreakdown`, `categoryMonthHeatmap`, `AmountBreakdownItem`, `CategoryMonthHeatmap` unchanged) with:

```ts
function bucketBySpending(transactions: Transaction[], keyFn: (t: Transaction) => string): AmountBreakdownItem[] {
  const buckets = new Map<string, { amount: number; count: number }>()
  for (const t of transactions) {
    if (resolvedFlowType(t) !== 'spending') continue
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

export function categoryBreakdown(transactions: Transaction[]): AmountBreakdownItem[] {
  return bucketBySpending(transactions, (t) => t.category)
}

export function subcategoryBreakdown(transactions: Transaction[], category: string): AmountBreakdownItem[] {
  return bucketBySpending(
    transactions.filter((t) => t.category === category),
    (t) => t.subcategory
  )
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/lib/aggregations.test.ts src/lib/dashboardAggregations.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/aggregations.ts src/lib/aggregations.test.ts src/lib/dashboardAggregations.ts src/lib/dashboardAggregations.test.ts
git commit -m "refactor: derive saving as income-minus-spending residual, drop includeSaving bucketing"
```

---

### Task 3: `entriesLogic.ts` — 2-section model + excluded-transaction helper

**Files:**
- Modify: `src/lib/entriesLogic.ts`
- Modify: `src/lib/entriesLogic.test.ts`

**Interfaces:**
- Consumes: `FlowType`, `Transaction` (Task 1).
- Produces (consumed by Task 7): `EntrySection = 'income' | 'spending'`, `ENTRY_SECTIONS: EntrySection[]` (2 entries), `ENTRY_SECTION_LABELS` (2 entries), `filterExcluded(transactions: Transaction[]): Transaction[]` (new — returns transactions manually overridden to `'neutral'`).

- [ ] **Step 1: Update `src/lib/entriesLogic.test.ts`**

Replace the `describe('filterBySection', ...)` block with:

```ts
describe('filterBySection', () => {
  it('returns only transactions resolved to the given section', () => {
    const txs = [tx({ id: 'a', flowType: 'spending' }), tx({ id: 'b', flowType: 'income' })]
    expect(filterBySection(txs, 'spending').map((t) => t.id)).toEqual(['a'])
  })

  it('resolves overrides before matching the section', () => {
    const txs = [tx({ id: 'a', flowType: 'income', flowTypeOverride: 'spending' })]
    expect(filterBySection(txs, 'spending').map((t) => t.id)).toEqual(['a'])
    expect(filterBySection(txs, 'income')).toEqual([])
  })

  it('excludes neutral transactions from every section', () => {
    const txs = [tx({ id: 'a', flowType: 'neutral' })]
    expect(filterBySection(txs, 'income')).toEqual([])
    expect(filterBySection(txs, 'spending')).toEqual([])
  })
})

describe('filterExcluded', () => {
  it('returns only transactions manually overridden to neutral', () => {
    const txs = [
      tx({ id: 'a', flowType: 'spending', flowTypeOverride: 'neutral' }),
      tx({ id: 'b', flowType: 'spending', flowTypeOverride: null }),
      tx({ id: 'c', flowType: 'neutral', flowTypeOverride: null }), // auto-neutral (e.g. a real paired transfer)
    ]
    expect(filterExcluded(txs).map((t) => t.id)).toEqual(['a'])
  })

  it('returns an empty array when nothing has been manually excluded', () => {
    const txs = [tx({ id: 'a', flowType: 'spending' }), tx({ id: 'b', flowType: 'neutral' })]
    expect(filterExcluded(txs)).toEqual([])
  })
})
```

Update the `applyEntryFieldPatch` describe block: delete the `'applies a negative amount for the saving section'` test case (the `'saving'` section no longer exists as an `EntrySection`), leave every other case as-is.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/entriesLogic.test.ts`
Expected: FAIL — `filterExcluded` doesn't exist yet; `filterBySection(txs, 'saving')`-shaped calls no longer type-check (already removed from the test file in Step 1, so this specific failure won't show, but the missing export will).

- [ ] **Step 3: Implement `src/lib/entriesLogic.ts`**

Change lines 4–12:

```ts
export type EntrySection = 'income' | 'spending'

export const ENTRY_SECTIONS: EntrySection[] = ['income', 'spending']

export const ENTRY_SECTION_LABELS: Record<EntrySection, string> = {
  income: '수입',
  spending: '지출',
}
```

Add a new function right after `filterBySection` (around line 18):

```ts
/** Transactions the user has manually excluded as "내 계좌 간 이동인데 잘못 찍힌 거래" — not a real automatic-neutral transfer, a deliberate override. */
export function filterExcluded(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => t.flowTypeOverride === 'neutral')
}
```

Leave `applyEntryFieldPatch` untouched — its `section === 'income' ? magnitude : -magnitude` sign logic already works correctly for a 2-member `EntrySection` with no code changes required, and its `category`/`subcategory` branch is unaffected.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/entriesLogic.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/entriesLogic.ts src/lib/entriesLogic.test.ts
git commit -m "refactor: entries screen to a 2-section (income/spending) model, add filterExcluded"
```

---

### Task 4: Supabase migration SQL

**Files:**
- Create: `supabase/migrations/0002_drop_saving_flow_type.sql`

**Interfaces:**
- None (SQL only — no TypeScript consumes this file).

No test file — this is a manual, one-time database migration. This repo has no linked Supabase CLI project (confirmed: no `supabase/config.toml`, no service-role key available to this environment), so it must be applied by hand.

- [ ] **Step 1: Create `supabase/migrations/0002_drop_saving_flow_type.sql`**

```sql
-- Data fix first, so the constraint rewrite below never rejects an existing row.
update transactions set flow_type = 'neutral' where flow_type = 'saving';
update transactions set flow_type_override = 'neutral' where flow_type_override = 'saving';
update classification_rules set flow_type = 'neutral' where flow_type = 'saving';

alter table transactions drop constraint if exists transactions_flow_type_check;
alter table transactions add constraint transactions_flow_type_check
  check (flow_type in ('income','spending','neutral'));

alter table transactions drop constraint if exists transactions_flow_type_override_check;
alter table transactions add constraint transactions_flow_type_override_check
  check (flow_type_override in ('spending','neutral'));

alter table classification_rules drop constraint if exists classification_rules_flow_type_check;
alter table classification_rules add constraint classification_rules_flow_type_check
  check (flow_type in ('spending','neutral'));
```

The constraint names above (`transactions_flow_type_check`, etc.) are Postgres's standard auto-generated name for an inline, unnamed `check (...)` column constraint (`{table}_{column}_check`) — matching how `0001_init.sql` defined them. `drop constraint if exists` makes this safe to run even if the guessed name is wrong (it just no-ops instead of erroring); the following `add constraint` still succeeds either way.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0002_drop_saving_flow_type.sql
git commit -m "feat: add migration dropping the saving flow_type value"
```

- [ ] **Step 3: Flag for manual execution**

This migration is NOT applied automatically. Note in the final task's report that the human partner must open the Supabase dashboard → SQL Editor for this project and run the contents of `supabase/migrations/0002_drop_saving_flow_type.sql` once, then (optionally) run `\d transactions` and `\d classification_rules` to confirm only the three expected check constraints remain on `flow_type`/`flow_type_override` — if the auto-generated names guessed above didn't match and an old constraint is still sitting there, drop it manually by the name shown in `\d`.

---

### Task 5: Store type + Import screen "전체 재분류" button

**Files:**
- Modify: `src/store/useTransactionStore.ts`
- Modify: `src/pages/ImportPage.tsx`

**Interfaces:**
- Consumes: `FlowType` (Task 1), `importRows` (existing, unchanged behavior).
- Produces: no new exports — `setOverride`'s parameter type narrows to match Task 1's `flowTypeOverride` type; `ImportPage` gains a "전체 재분류" button.

No test file (store/page, same rationale as every other `.tsx`/store change in this project — verified via `npm run build` in the final task and a manual smoke check here).

- [ ] **Step 1: Update `src/store/useTransactionStore.ts`**

Change the `setOverride` signature in the `TransactionStoreState` interface (currently `setOverride: (id: string, override: 'saving' | 'spending' | null) => Promise<void>`):

```ts
  setOverride: (id: string, override: 'spending' | 'neutral' | null) => Promise<void>
```

No other change is needed in this file: `classifyFlowType`'s return type already flows from Task 1's updated `FlowType`, and `importRows`'s existing full-reclassify-on-every-call behavior (already reclassifies `get().transactions` plus any new rows, see the `allTransactions`/`finalized` logic around line 183–212) is exactly the mechanism Step 2 below hangs the "전체 재분류" button on — calling `importRows([])` triggers the same reclassification path with zero new rows.

- [ ] **Step 2: Add the "전체 재분류" button to `src/pages/ImportPage.tsx`**

Add a new state and handler near the top of the component (after the existing `importRows` selector on line 12):

```ts
  const [reclassifying, setReclassifying] = useState(false)

  async function handleReclassifyAll() {
    setReclassifying(true)
    setError(null)
    try {
      await importRows([])
      setSummary(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setReclassifying(false)
    }
  }
```

Add the button in the JSX, right after the `<h1>` heading (before the file `<input>`):

```tsx
      <button
        onClick={handleReclassifyAll}
        disabled={reclassifying}
        className="mb-6 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        {reclassifying ? '재분류 중…' : '전체 재분류 (분류 알고리즘이 바뀐 뒤 파일 없이 다시 계산)'}
      </button>
```

- [ ] **Step 3: Verify the build for this file in isolation**

Run: `npx tsc --noEmit -p tsconfig.json` — this will still show errors from files not yet updated by later tasks (`EntriesPage.tsx`, `CategoryDonut.tsx`, `DashboardPage.tsx`, `DayTransactionPanel.tsx`, `EntriesToolbar.tsx`); confirm the errors reported do NOT include `useTransactionStore.ts` or `ImportPage.tsx` — those two files must be clean.

- [ ] **Step 4: Commit**

```bash
git add src/store/useTransactionStore.ts src/pages/ImportPage.tsx
git commit -m "feat: reclassify-all button on the import screen, narrow setOverride's type"
```

---

### Task 6: Dashboard cleanup — `CategoryDonut.tsx`, `DashboardPage.tsx`, `DayTransactionPanel.tsx`

**Files:**
- Modify: `src/components/dashboard/CategoryDonut.tsx`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/components/month/DayTransactionPanel.tsx`

**Interfaces:**
- Consumes: `categoryBreakdown`, `subcategoryBreakdown` (Task 2, no more `includeSaving` param), `resolvedFlowType` (Task 1, narrowed `FlowType`).

No test file (all three are `.tsx`, same rationale as Task 5).

- [ ] **Step 1: Update `src/components/dashboard/CategoryDonut.tsx`**

Remove the `includeSaving` state and the "저축 포함" checkbox entirely. Replace the whole file with:

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

  const items: AmountBreakdownItem[] = useMemo(
    () => (drilldown ? subcategoryBreakdown(transactions, drilldown) : categoryBreakdown(transactions)),
    [transactions, drilldown]
  )

  const total = items.reduce((sum, i) => sum + i.amount, 0)

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-medium text-slate-700">
          지출 카테고리 구성 {drilldown && <span className="text-slate-400">/ {drilldown}</span>}
        </p>
        {drilldown && (
          <button onClick={() => setDrilldown(null)} className="text-sm text-blue-600 hover:underline">
            ← 대분류로 돌아가기
          </button>
        )}
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

- [ ] **Step 2: Fix the two local `netCashFlow` calculations in `src/pages/DashboardPage.tsx`**

Change line 37 from `const netCashFlow = income - spending - saving` to:

```ts
    const netCashFlow = income - spending
```

(No other line in this file changes — `saving` is still computed the same way at line 36, `savingsRate` at line 38 is untouched, and every prop passed to `KpiCards`/`MonthlyTrendChart` keeps its name.)

- [ ] **Step 3: Update `src/components/month/DayTransactionPanel.tsx`**

Remove the `saving` entry from `AMOUNT_COLOR_BY_FLOW` (lines 11–16):

```ts
const AMOUNT_COLOR_BY_FLOW: Record<ReturnType<typeof resolvedFlowType>, string> = {
  income: 'text-blue-600',
  spending: 'text-rose-600',
  neutral: 'text-slate-500',
}
```

- [ ] **Step 4: Verify these three files compile clean in isolation**

Run: `npx tsc --noEmit -p tsconfig.json` and confirm none of the reported errors reference `CategoryDonut.tsx`, `DashboardPage.tsx`, or `DayTransactionPanel.tsx` (errors from `EntriesPage.tsx`/`EntriesToolbar.tsx`, not yet touched, are still expected at this point).

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/CategoryDonut.tsx src/pages/DashboardPage.tsx src/components/month/DayTransactionPanel.tsx
git commit -m "refactor: drop dead saving-flow UI (donut toggle, day-panel color, dashboard netCashFlow)"
```

---

### Task 7: Entries screen — 2 tabs, "이체로 제외" override, "제외됨" filter + 복구

**Files:**
- Modify: `src/components/entries/EntriesToolbar.tsx`
- Modify: `src/pages/EntriesPage.tsx`
- Modify: `src/lib/categories.ts`

**Interfaces:**
- Consumes: `EntrySection`, `ENTRY_SECTIONS`, `ENTRY_SECTION_LABELS`, `filterExcluded` (Task 3); `SEED_INCOME_CATEGORIES`, `SEED_EXPENSE_CATEGORIES`, `SEED_PAYMENT_METHODS`, `mergeObservedCategories`, `mergeObservedFlatList`, `mergeObservedPaymentMethods` (unchanged, `src/lib/categories.ts`).

No test file (page/component composition, same rationale as every other `.tsx` file in this project). `categories.ts`'s own test file needs no change — `categories.test.ts` never imported `SEED_SAVING_CATEGORIES` in the first place (confirmed: it only imports `SEED_EXPENSE_CATEGORIES`, `SEED_INCOME_CATEGORIES`, `SEED_PAYMENT_METHODS`).

- [ ] **Step 0: Delete the now-unused `SEED_SAVING_CATEGORIES` from `src/lib/categories.ts`**

Delete line 5 (`export const SEED_SAVING_CATEGORIES = ['투자', '청약저축', '적금', '증권/투자', '기타']`) and the blank line directly after it. Nothing else in this file changes.

- [ ] **Step 1: Add the "제외됨 (N)" toggle to `src/components/entries/EntriesToolbar.tsx`**

Add two new props to `EntriesToolbarProps` (after `paymentMethodOptions`/`onPaymentMethodFilterChange`):

```ts
  showExcluded: boolean
  excludedCount: number
  onToggleShowExcluded: () => void
```

Destructure them in the function signature, and add a toggle button at the end of the filter row `<div className="flex flex-wrap items-center gap-3">` (right after the payment-method `<select>`, before its closing `</div>`):

```tsx
        <button
          onClick={onToggleShowExcluded}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
            showExcluded ? 'border-slate-400 bg-slate-100 text-slate-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          제외됨 ({excludedCount})
        </button>
```

- [ ] **Step 2: Rewrite `src/pages/EntriesPage.tsx`**

This task replaces the whole file. Key changes from the current version:
- `SEED_SAVING_CATEGORIES`, `savingCategoryOptions` removed from the `categories` import and from the component entirely.
- `createDraft` drops its `section === 'saving'` branches (only `income`/`spending` remain).
- `filterExcluded` imported from `entriesLogic`; a new `showExcluded` boolean state; when `true`, `sortedRows` is built from `filterExcluded(transactions)` (further narrowed by month/search/sort, but NOT by section — an excluded row could be either direction) instead of the normal section/category/payment pipeline.
- `overrideAction` no longer offers "저축으로 전환"/"지출로 전환" — it offers **"이체로 제외"** on both tabs (`setOverride(row.id, 'neutral')`), and when `showExcluded` is on, the table instead needs a **"복구"** action (`setOverride(row.id, null)`) — handled via a second, conditional `overrideAction` computed from `showExcluded`.

Replace the whole file with:

```tsx
import { useEffect, useMemo, useState } from 'react'
import EntriesToolbar from '../components/entries/EntriesToolbar'
import EntriesTable, { type EntryColumnDef } from '../components/entries/EntriesTable'
import { useTransactionStore } from '../store/useTransactionStore'
import { listAvailableMonths } from '../lib/aggregations'
import {
  applyEntryFieldPatch,
  currentMonthKey,
  defaultDateForMonth,
  filterByMonth,
  filterBySection,
  filterExcluded,
  isPartialMonth,
  searchEntries,
  sortEntries,
  type EntryColumnKey,
  type EntrySection,
  type SortDirection,
  type SortField,
} from '../lib/entriesLogic'
import { computeTransactionId } from '../lib/idHash'
import {
  SEED_EXPENSE_CATEGORIES,
  SEED_INCOME_CATEGORIES,
  SEED_PAYMENT_METHODS,
  mergeObservedCategories,
  mergeObservedFlatList,
  mergeObservedPaymentMethods,
} from '../lib/categories'
import type { Transaction } from '../types/transaction'

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function createDraft(section: EntrySection, month: string): Transaction {
  return {
    id: '__draft__',
    date: defaultDateForMonth(month, new Date()),
    time: '12:00:00',
    type: section === 'income' ? '수입' : '지출',
    category: section === 'income' ? SEED_INCOME_CATEGORIES[0] : Object.keys(SEED_EXPENSE_CATEGORIES)[0],
    subcategory: '미분류',
    content: '',
    amount: 0,
    currency: 'KRW',
    paymentMethod: SEED_PAYMENT_METHODS[0],
    memo: null,
    flowType: section,
    flowTypeOverride: null,
    transferPairId: null,
    isPairedTransfer: false,
    isUnmatchedTransfer: false,
  }
}

export default function EntriesPage() {
  const transactions = useTransactionStore((s) => s.transactions)
  const updateTransaction = useTransactionStore((s) => s.updateTransaction)
  const deleteTransaction = useTransactionStore((s) => s.deleteTransaction)
  const addTransaction = useTransactionStore((s) => s.addTransaction)
  const setOverride = useTransactionStore((s) => s.setOverride)

  const [section, setSection] = useState<EntrySection>('spending')
  const availableMonths = useMemo(() => listAvailableMonths(transactions), [transactions])
  const [month, setMonth] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [draft, setDraft] = useState<Transaction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showExcluded, setShowExcluded] = useState(false)
  // True while `month` holds the "no data at all yet" fallback (the current real month) rather than
  // a month derived from actual data — lets us re-sync once transactions finish loading.
  const [monthIsFallback, setMonthIsFallback] = useState(false)

  useEffect(() => {
    if (availableMonths.length === 0) {
      // Empty database: fall back to the current real month so a brand-new user still gets a
      // toolbar, an empty table and a working "+ 추가" button instead of a dead-end message.
      if (!month) {
        setMonth(currentMonthKey(new Date()))
        setMonthIsFallback(true)
      }
      return
    }
    if (!month || monthIsFallback) {
      setMonth(availableMonths[availableMonths.length - 1])
      setMonthIsFallback(false)
    }
  }, [availableMonths, month, monthIsFallback])

  // The month dropdown must always contain the selected month, including the empty-database fallback.
  const monthOptions = useMemo(
    () => (!month || availableMonths.includes(month) ? availableMonths : [...availableMonths, month].sort()),
    [availableMonths, month]
  )
  // Dropdown displays most recent month first; monthOptions itself stays ascending for the fallback-insertion logic above.
  const monthOptionsDesc = useMemo(() => [...monthOptions].reverse(), [monthOptions])

  // Section switches also reset the filter dropdowns, whose option lists are section-specific.
  useEffect(() => {
    setCategoryFilter('ALL')
    setPaymentMethodFilter('ALL')
  }, [section])

  // Any change to what is on screen clears the selection and the open draft, so bulk actions can
  // never target rows the user can no longer see.
  useEffect(() => {
    setSelectedIds(new Set())
    setDraft(null)
  }, [section, month, categoryFilter, paymentMethodFilter, search, showExcluded])

  const excludedRows = useMemo(() => filterExcluded(transactions), [transactions])
  const baseRows = useMemo(
    () => (showExcluded ? excludedRows : filterBySection(transactions, section)),
    [showExcluded, excludedRows, transactions, section]
  )
  const monthRows = useMemo(() => filterByMonth(baseRows, month), [baseRows, month])
  const categoryFiltered = useMemo(
    () => (categoryFilter === 'ALL' ? monthRows : monthRows.filter((t) => t.category === categoryFilter)),
    [monthRows, categoryFilter]
  )
  const paymentFiltered = useMemo(
    () =>
      paymentMethodFilter === 'ALL'
        ? categoryFiltered
        : categoryFiltered.filter((t) => t.paymentMethod === paymentMethodFilter),
    [categoryFiltered, paymentMethodFilter]
  )
  const searched = useMemo(() => searchEntries(paymentFiltered, search), [paymentFiltered, search])
  const sortedRows = useMemo(
    () => sortEntries(searched, sortField, sortDirection),
    [searched, sortField, sortDirection]
  )
  const totalAmount = useMemo(() => sortedRows.reduce((sum, t) => sum + t.amount, 0), [sortedRows])

  const sectionRowsForFilters = useMemo(
    () => (showExcluded ? excludedRows : filterBySection(transactions, section)),
    [showExcluded, excludedRows, transactions, section]
  )
  const categoryFilterOptions = useMemo(
    () => [...new Set(sectionRowsForFilters.map((t) => t.category))].sort(),
    [sectionRowsForFilters]
  )
  const paymentMethodFilterOptions = useMemo(
    () => [...new Set(sectionRowsForFilters.map((t) => t.paymentMethod))].sort(),
    [sectionRowsForFilters]
  )

  const paymentMethodOptions = useMemo(
    () => mergeObservedPaymentMethods(transactions.map((t) => t.paymentMethod)),
    [transactions]
  )
  const incomeCategoryOptions = useMemo(
    () =>
      mergeObservedFlatList(SEED_INCOME_CATEGORIES, filterBySection(transactions, 'income').map((t) => t.category)),
    [transactions]
  )
  const expenseCategories = useMemo(
    () =>
      mergeObservedCategories(
        SEED_EXPENSE_CATEGORIES,
        filterBySection(transactions, 'spending').map((t) => ({ category: t.category, subcategory: t.subcategory }))
      ),
    [transactions]
  )

  const columns: EntryColumnDef[] = useMemo(() => {
    if (section === 'income') {
      return [
        { key: 'date', label: '날짜', type: 'date' },
        { key: 'paymentMethod', label: '입금수단', type: 'select', options: paymentMethodOptions },
        { key: 'category', label: '대분류', type: 'select', options: incomeCategoryOptions },
        { key: 'content', label: '내용', type: 'text' },
        { key: 'amount', label: '금액', type: 'amount' },
      ]
    }
    return [
      { key: 'date', label: '날짜', type: 'date' },
      { key: 'paymentMethod', label: '결제수단', type: 'select', options: paymentMethodOptions },
      { key: 'category', label: '대분류', type: 'select', options: Object.keys(expenseCategories) },
      {
        key: 'subcategory',
        label: '소분류',
        type: 'select',
        options: (row: Transaction) => expenseCategories[row.category] ?? [],
      },
      { key: 'content', label: '지출내용', type: 'text' },
      { key: 'amount', label: '금액', type: 'amount' },
    ]
  }, [section, paymentMethodOptions, incomeCategoryOptions, expenseCategories])

  async function handleSetOverride(id: string, override: 'spending' | 'neutral' | null) {
    try {
      await setOverride(id, override)
      setError(null)
    } catch (err) {
      setError(`분류 변경에 실패했습니다: ${errorText(err)}`)
    }
  }

  // Normal view: offer "이체로 제외" on every row (both tabs) — the user manually flags a
  // mistakenly-typed internal transfer. Excluded view: offer "복구" instead, clearing the override.
  const overrideAction = showExcluded
    ? {
        label: () => '복구',
        onClick: (row: Transaction) => handleSetOverride(row.id, null),
      }
    : {
        label: () => '이체로 제외',
        onClick: (row: Transaction) => handleSetOverride(row.id, 'neutral'),
      }

  async function handleEditField(id: string, key: EntryColumnKey, value: string | number) {
    // Preserve the row's existing sign when editing an amount: a positive `spending` row is a refund,
    // and forcing the section's default sign would silently turn it into a charge.
    const currentAmount = key === 'amount' ? transactions.find((t) => t.id === id)?.amount : undefined
    try {
      await updateTransaction(id, applyEntryFieldPatch(section, key, value, currentAmount))
      setError(null)
    } catch (err) {
      setError(`저장에 실패했습니다: ${errorText(err)}`)
    }
  }

  function handleDraftChange(key: EntryColumnKey, value: string | number) {
    setDraft((prev) => (prev ? { ...prev, ...applyEntryFieldPatch(section, key, value) } : prev))
  }

  async function handleDraftSave() {
    if (!draft) return
    if (!draft.content.trim() || draft.amount === 0) return
    const id = await computeTransactionId({
      date: draft.date,
      time: draft.time,
      type: draft.type,
      category: draft.category,
      subcategory: draft.subcategory,
      content: draft.content,
      amount: draft.amount,
      paymentMethod: draft.paymentMethod,
    })
    try {
      await addTransaction({ ...draft, id })
      setDraft(null)
      setError(null)
    } catch (err) {
      setError(`저장에 실패했습니다: ${errorText(err)}`)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === sortedRows.length ? new Set() : new Set(sortedRows.map((t) => t.id))))
  }

  async function handleBulkDelete() {
    // Belt-and-suspenders: only ever delete rows that are actually on screen right now, even if some
    // future filter path forgets to clear the selection.
    const visibleIds = new Set(sortedRows.map((t) => t.id))
    const ids = [...selectedIds].filter((id) => visibleIds.has(id))
    if (ids.length === 0) {
      setSelectedIds(new Set())
      return
    }
    if (!window.confirm(`선택한 ${ids.length}건을 삭제하시겠습니까?`)) return

    const results = await Promise.allSettled(ids.map((id) => deleteTransaction(id)))
    setSelectedIds(new Set())
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) {
      setError(`삭제에 실패했습니다: ${ids.length}건 중 ${ids.length - failed}건 삭제, ${failed}건 실패했습니다.`)
    } else {
      setError(null)
    }
  }

  async function handleDeleteRow(id: string) {
    if (!window.confirm('이 항목을 삭제하시겠습니까?')) return
    try {
      await deleteTransaction(id)
      setError(null)
    } catch (err) {
      setError(`삭제에 실패했습니다: ${errorText(err)}`)
    }
  }

  function handleSortChange(field: SortField) {
    if (field === sortField) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  if (!month) {
    return (
      <div className="rounded-xl bg-white p-6 text-slate-500 shadow-sm">
        불러온 데이터가 없습니다. 먼저 데이터를 불러와주세요.
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-800">거래 입력/관리</h1>

      {error && (
        <div className="mb-4 flex items-start justify-between gap-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 font-medium hover:underline">
            닫기
          </button>
        </div>
      )}

      <EntriesToolbar
        section={section}
        onSectionChange={setSection}
        month={month}
        availableMonths={monthOptionsDesc}
        isPartial={isPartialMonth(transactions, month)}
        onMonthChange={setMonth}
        search={search}
        onSearchChange={setSearch}
        categoryFilter={categoryFilter}
        categoryOptions={categoryFilterOptions}
        onCategoryFilterChange={setCategoryFilter}
        paymentMethodFilter={paymentMethodFilter}
        paymentMethodOptions={paymentMethodFilterOptions}
        onPaymentMethodFilterChange={setPaymentMethodFilter}
        showExcluded={showExcluded}
        excludedCount={excludedRows.length}
        onToggleShowExcluded={() => setShowExcluded((v) => !v)}
      />

      <div className="mt-4">
        <EntriesTable
          columns={columns}
          rows={sortedRows}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onBulkDelete={handleBulkDelete}
          onDeleteRow={handleDeleteRow}
          onEditField={handleEditField}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          totalAmount={totalAmount}
          draftRow={draft}
          onDraftChange={handleDraftChange}
          onDraftSave={handleDraftSave}
          onDraftCancel={() => setDraft(null)}
          onStartDraft={() => setDraft(createDraft(section, month))}
          overrideAction={overrideAction}
        />
      </div>
    </div>
  )
}
```

A few things worth noting about this rewrite, since a fresh reviewer won't have the prior context:
- `EntryColumnDef.options` for `category`/`subcategory` in the excluded view still resolves via each row's own `section`-shaped column defs, but `columns` itself is still keyed off `section` state (not `showExcluded`) — when `showExcluded` is on, rows from BOTH income and spending can appear together, yet the table only renders one `columns` config (whatever `section` currently is). This is an accepted simplification: the excluded view is a flat review/undo list, not a fully section-typed table, so a stray income row shown under "지출" column labels while `showExcluded` is on is a cosmetic mismatch, not a data problem (editing category/date/content/payment method/amount still works correctly against whichever row it actually is). If this reads as confusing once tested in the browser, note it in the task report as a concern for the next iteration rather than silently expanding scope here.
- `canClearOverride`/`row.flowType !== 'neutral'` gating from the previous version is gone — it existed specifically to protect against clearing a `saving`/`spending` override into a vanishing `neutral` state, which is no longer a risk now that `'neutral'` clearing is the intended, visible (via `showExcluded`), reversible action.

- [ ] **Step 3: Verify these two files compile clean, and the whole app builds**

Run: `npm run build`
Expected: PASS — this is the last file in the dependency chain, so the full `tsc -b && vite build` should now succeed with zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/entries/EntriesToolbar.tsx src/pages/EntriesPage.tsx src/lib/categories.ts
git commit -m "feat: entries screen — 2-tab model, manual 이체로 제외 override, excluded-transactions view/restore"
```

---

### Task 8: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: PASS — every test file in the repo green, including all files touched by Tasks 1–3.

- [ ] **Step 2: Run the full build**

Run: `npm run build`
Expected: PASS — zero TypeScript errors across the whole project.

- [ ] **Step 3: Manual browser smoke test**

Run `npm run dev`, log in, and verify by hand:
- `/entries`: only 2 tabs (수입/지출) render.
- On the 지출 tab, a row's action button reads "이체로 제외"; clicking it makes the row disappear from the tab.
- Toolbar's "제외됨 (N)" count increments after the above; clicking the toggle shows that row with a "복구" button; clicking 복구 returns it to its original tab.
- `/import`: the "전체 재분류" button is present and, when clicked with existing data loaded, completes without error.
- `/` (dashboard): KPI cards, monthly trend chart, and category donut all render without a "저축 포함" checkbox anywhere; numbers look sane (저축·투자 KPI ≈ 수입 − 지출 for the selected period).
- `/month/<any loaded month>`: day transaction panel still color-codes amounts correctly (no console error from a missing `AMOUNT_COLOR_BY_FLOW` key).

Report per-bullet pass/fail honestly in the task report — do not fabricate a pass on anything not actually observed.

- [ ] **Step 4: Remind about the manual Supabase migration**

In the task report, restate clearly: the human partner MUST run `supabase/migrations/0002_drop_saving_flow_type.sql` in the Supabase dashboard's SQL Editor **before** deploying this branch's build to production — this is a hard prerequisite, not a nice-to-have. The current (pre-migration) `flow_type_override` check constraint only allows `'saving'`/`'spending'`, not `'neutral'`; the new "이체로 제외" feature writes `flowTypeOverride: 'neutral'` on every use, so every click of that button would fail with a constraint violation until the migration runs. Order: run the migration first, THEN deploy, THEN click "전체 재분류" once on `/import` to reclassify all existing transactions under the new algorithm. Also flag: the migration's data-fix converts any legacy `flow_type_override = 'saving'` row into `'neutral'` (a manual exclusion) — those rows will appear in "제외됨 (N)" the first time the app loads post-migration; this is semantically correct (they were already excluded from spending) but may be a surprising non-zero count worth mentioning to the user.

No commit for this task (verification only, nothing to stage).
