# Entries (거래 입력/관리) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the transaction input/management screen (`/entries`) — three tabbed sections (수입/저축·투자/지출) over the existing transaction store, with month filtering, inline cell editing, row add/delete (single + bulk), sort, search, category/payment-method filters, and a manual saving↔spending override toggle — per the original spec's "화면 구성" section 3.

**Architecture:** Pure, unit-tested filtering/sorting/patch logic lives in `src/lib/entriesLogic.ts` (new) and additions to `src/lib/categories.ts`. UI is a small set of focused, config-driven components under `src/components/entries/` (an `EntriesTable` generic enough to serve all three sections via a `columns` prop, plus small `EditableSelect`/`AmountInput` primitives and an `EntriesToolbar`), composed by `src/pages/EntriesPage.tsx`. One new store method (`addTransaction`) is added to the existing Zustand store for manually-added rows. No schema changes.

**Tech Stack:** React 18 + TypeScript, react-router-dom v6, Zustand (existing store), Tailwind CSS, Vitest (lib-layer TDD only — this codebase has no component-level tests; UI correctness is verified via `tsc`/`npm run build` and manual browser smoke test, matching the established pattern for every existing `.tsx` file in this project).

## Global Constraints

- Source docs: `docs/superpowers/specs/2026-07-19-budget-book-design.md` (architecture/data rules) and `가계부앱_클로드코드_첫프롬프트.md` lines 160-176 ("3. 거래 입력/관리 (`/entries`)" — the screen this plan builds) and lines 71-100 (저축성/소비성 구분 + 오버라이드 규칙, already implemented in `src/lib/classification.ts`).
- Colors (already established, reuse exactly): 수입 = `text-blue-600`, 지출 = `text-rose-600`, 저축 = `text-emerald-600`. Buttons: primary action `bg-blue-600 text-white`, destructive `text-rose-600`/`bg-rose-50`, matching `src/pages/ImportPage.tsx` and `src/components/AppShell.tsx`.
- Currency formatting: reuse `formatKRW` from `src/lib/format.ts` for display. Do not create a new formatter.
- Month keys are `YYYY-MM` strings everywhere (`transaction.date.slice(0, 7)`), matching `src/lib/aggregations.ts`.
- Existing store shape (`src/store/useTransactionStore.ts`), unchanged except for the one addition in Task 6: `{ transactions: Transaction[], rules: ClassificationRule[], loading: boolean, fetchAll, importRows, updateTransaction, deleteTransaction, setOverride, addRule }`.
- Existing `Transaction` type (`src/types/transaction.ts`, unchanged): `{ id, date: string (YYYY-MM-DD), time: string (HH:MM:SS), type: '수입'|'지출'|'이체', category, subcategory, content, amount: number (signed), currency, paymentMethod, memo: string|null, flowType: 'income'|'saving'|'spending'|'neutral', flowTypeOverride: 'saving'|'spending'|null, transferPairId, isPairedTransfer, isUnmatchedTransfer }`.
- `resolvedFlowType(tx)` (`src/lib/aggregations.ts`) always resolves override-vs-computed. This plan's section filtering (which of the 3 tabs a transaction belongs to) MUST use `resolvedFlowType`, never `t.flowType` directly.
- Git repo: commit directly to `master` after every task (established pattern for this project — no feature branch).
- Amount input UX decision: the user always types/edits a **positive magnitude**. The active section tab determines the sign that gets written to `Transaction.amount` (income → positive, saving/spending → negative). The stored data model itself is unchanged (still a single signed `amount` field, per design doc 3.4) — this only affects how the edit UI collects a number from the user.
- Editing an existing transaction's fields in this screen never re-runs `classifyFlowType` or transfer-pairing recomputation — this matches the existing `updateTransaction` store method, which is a plain field patch. Only **newly-added** rows (via the "+ 추가" button) get an explicit, section-appropriate `flowTypeOverride` set at creation time (`null` for income, `'saving'`/`'spending'` for the other two tabs) so they are guaranteed to land in the tab the user added them from, regardless of what category/payment method they later pick.

**Deliberate scope reductions from the original spec, flagged here rather than silently built partial:**
- **No dedicated classification-rule management screen** (원본 스펙 90행: "오버라이드 규칙을... 룰 관리 화면 하나로"). The store's `addRule` method already exists but stays unused by this plan. This plan instead exposes the simpler, already-required per-transaction override (원본 스펙 89행) as a "저축으로 전환"/"지출로 전환" button on each 지출/저축 row, via the existing `setOverride` store method. A "가맹점당 항상 OO로" rule-authoring UI is a separate, self-contained screen — deferred to a follow-up plan.
- **No separate "이체 내역" tab.** The original spec mentions viewing transfers in passing (line 49) but the screen list this plan follows (lines 160-183) only defines 4 screens (dashboard, month detail, entries, import) with no dedicated transfer view. Out of scope here.
- **New-row time defaults to a fixed `12:00:00`**, no time picker — the spec's "행 추가" bullet (line 171) only specifies a *date* default ("현재 선택된 월의 오늘(또는 1일)"), not time.
- **No drag-to-reorder, no CSV/Excel export from this screen** — not requested by the spec section this plan implements.

These items should be confirmed with the human before or during execution — they are gaps against the original spec, not oversights to silently ship.

---

### Task 1: Entries filtering/sorting/patch logic (`src/lib/entriesLogic.ts`)

**Files:**
- Create: `src/lib/entriesLogic.ts`
- Test: `src/lib/entriesLogic.test.ts`

**Interfaces:**
- Consumes: `Transaction` (`src/types/transaction.ts`), `resolvedFlowType` (`src/lib/aggregations.ts`).
- Produces (consumed by Tasks 4, 5, and 6): `EntrySection` type, `EntryColumnKey` type, `SortField`/`SortDirection` types, `ENTRY_SECTIONS`, `ENTRY_SECTION_LABELS`, `filterBySection(transactions, section)`, `filterByMonth(transactions, month)`, `isPartialMonth(allTransactions, month)`, `defaultDateForMonth(month, today)`, `searchEntries(transactions, query)`, `sortEntries(transactions, field, direction)`, `applyEntryFieldPatch(section, key, value)`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/entriesLogic.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  applyEntryFieldPatch,
  defaultDateForMonth,
  filterByMonth,
  filterBySection,
  isPartialMonth,
  searchEntries,
  sortEntries,
} from './entriesLogic'
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

describe('filterBySection', () => {
  it('returns only transactions resolved to the given section', () => {
    const txs = [tx({ id: 'a', flowType: 'spending' }), tx({ id: 'b', flowType: 'income' })]
    expect(filterBySection(txs, 'spending').map((t) => t.id)).toEqual(['a'])
  })

  it('resolves overrides before matching the section', () => {
    const txs = [tx({ id: 'a', flowType: 'spending', flowTypeOverride: 'saving' })]
    expect(filterBySection(txs, 'saving').map((t) => t.id)).toEqual(['a'])
    expect(filterBySection(txs, 'spending')).toEqual([])
  })

  it('excludes neutral transactions from every section', () => {
    const txs = [tx({ id: 'a', flowType: 'neutral' })]
    expect(filterBySection(txs, 'income')).toEqual([])
    expect(filterBySection(txs, 'saving')).toEqual([])
    expect(filterBySection(txs, 'spending')).toEqual([])
  })
})

describe('filterByMonth', () => {
  it('keeps only transactions whose date falls in the given month', () => {
    const txs = [tx({ id: 'a', date: '2026-07-15' }), tx({ id: 'b', date: '2026-08-01' })]
    expect(filterByMonth(txs, '2026-07').map((t) => t.id)).toEqual(['a'])
  })
})

describe('isPartialMonth', () => {
  it('flags the earliest month when data starts after the 1st', () => {
    const txs = [tx({ date: '2025-07-19' }), tx({ date: '2026-07-19' })]
    expect(isPartialMonth(txs, '2025-07')).toBe(true)
  })

  it('flags the latest month when data ends before the last day of that month', () => {
    const txs = [tx({ date: '2025-07-19' }), tx({ date: '2026-07-19' })]
    expect(isPartialMonth(txs, '2026-07')).toBe(true)
  })

  it('does not flag a fully-covered middle month', () => {
    const txs = [tx({ date: '2025-07-19' }), tx({ date: '2025-08-15' }), tx({ date: '2026-07-19' })]
    expect(isPartialMonth(txs, '2025-08')).toBe(false)
  })

  it('returns false for an empty dataset', () => {
    expect(isPartialMonth([], '2026-07')).toBe(false)
  })
})

describe('defaultDateForMonth', () => {
  it("returns today's date when the selected month is the current real month", () => {
    const today = new Date(2026, 6, 15) // 2026-07-15 (month is 0-indexed)
    expect(defaultDateForMonth('2026-07', today)).toBe('2026-07-15')
  })

  it('returns the 1st of the month when viewing a past or future month', () => {
    const today = new Date(2026, 6, 15)
    expect(defaultDateForMonth('2026-05', today)).toBe('2026-05-01')
  })
})

describe('searchEntries', () => {
  it('matches content case-insensitively', () => {
    const txs = [tx({ id: 'a', content: '스타벅스' })]
    expect(searchEntries(txs, '벅스').map((t) => t.id)).toEqual(['a'])
  })

  it('matches memo when content does not match', () => {
    const txs = [tx({ id: 'a', content: '스타벅스', memo: '생일선물' })]
    expect(searchEntries(txs, '생일').map((t) => t.id)).toEqual(['a'])
  })

  it('treats a null memo as empty rather than throwing', () => {
    const txs = [tx({ id: 'a', content: '스타벅스', memo: null })]
    expect(() => searchEntries(txs, '없음')).not.toThrow()
    expect(searchEntries(txs, '없음')).toEqual([])
  })

  it('returns all transactions when the query is blank', () => {
    const txs = [tx({ id: 'a' }), tx({ id: 'b' })]
    expect(searchEntries(txs, '  ')).toHaveLength(2)
  })
})

describe('sortEntries', () => {
  it('sorts by date ascending', () => {
    const txs = [tx({ id: 'a', date: '2026-07-20' }), tx({ id: 'b', date: '2026-07-01' })]
    expect(sortEntries(txs, 'date', 'asc').map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('sorts by date descending', () => {
    const txs = [tx({ id: 'a', date: '2026-07-20' }), tx({ id: 'b', date: '2026-07-01' })]
    expect(sortEntries(txs, 'date', 'desc').map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('sorts by amount ascending', () => {
    const txs = [tx({ id: 'a', amount: -500 }), tx({ id: 'b', amount: -2000 })]
    expect(sortEntries(txs, 'amount', 'asc').map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('does not mutate the input array', () => {
    const txs = [tx({ id: 'a', date: '2026-07-20' }), tx({ id: 'b', date: '2026-07-01' })]
    sortEntries(txs, 'date', 'asc')
    expect(txs.map((t) => t.id)).toEqual(['a', 'b'])
  })
})

describe('applyEntryFieldPatch', () => {
  it('applies a positive amount for the income section', () => {
    expect(applyEntryFieldPatch('income', 'amount', 50000)).toEqual({ amount: 50000 })
  })

  it('applies a negative amount for the spending section', () => {
    expect(applyEntryFieldPatch('spending', 'amount', 50000)).toEqual({ amount: -50000 })
  })

  it('applies a negative amount for the saving section', () => {
    expect(applyEntryFieldPatch('saving', 'amount', 50000)).toEqual({ amount: -50000 })
  })

  it('resets subcategory to 미분류 when the spending category changes', () => {
    expect(applyEntryFieldPatch('spending', 'category', '생활')).toEqual({ category: '생활', subcategory: '미분류' })
  })

  it('does not touch subcategory when the income category changes', () => {
    expect(applyEntryFieldPatch('income', 'category', '용돈')).toEqual({ category: '용돈' })
  })

  it('passes other fields through as-is', () => {
    expect(applyEntryFieldPatch('spending', 'content', '스타벅스')).toEqual({ content: '스타벅스' })
    expect(applyEntryFieldPatch('spending', 'paymentMethod', '토스 간편결제')).toEqual({ paymentMethod: '토스 간편결제' })
    expect(applyEntryFieldPatch('spending', 'date', '2026-07-10')).toEqual({ date: '2026-07-10' })
    expect(applyEntryFieldPatch('spending', 'subcategory', '배달')).toEqual({ subcategory: '배달' })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `src/lib/entriesLogic.ts` does not exist yet.

- [ ] **Step 3: Implement `src/lib/entriesLogic.ts`**

```ts
import type { Transaction } from '../types/transaction'
import { resolvedFlowType } from './aggregations'

export type EntrySection = 'income' | 'saving' | 'spending'

export const ENTRY_SECTIONS: EntrySection[] = ['income', 'saving', 'spending']

export const ENTRY_SECTION_LABELS: Record<EntrySection, string> = {
  income: '수입',
  saving: '저축·투자',
  spending: '지출',
}

export type EntryColumnKey = 'date' | 'content' | 'category' | 'subcategory' | 'paymentMethod' | 'amount'

export function filterBySection(transactions: Transaction[], section: EntrySection): Transaction[] {
  return transactions.filter((t) => resolvedFlowType(t) === section)
}

export function filterByMonth(transactions: Transaction[], month: string): Transaction[] {
  return transactions.filter((t) => t.date.slice(0, 7) === month)
}

export function isPartialMonth(allTransactions: Transaction[], month: string): boolean {
  if (allTransactions.length === 0) return false
  const dates = allTransactions.map((t) => t.date).sort()
  const minDate = dates[0]
  const maxDate = dates[dates.length - 1]
  const minMonth = minDate.slice(0, 7)
  const maxMonth = maxDate.slice(0, 7)

  if (month === minMonth && Number(minDate.slice(8, 10)) !== 1) return true

  if (month === maxMonth) {
    const [y, m] = maxMonth.split('-').map(Number)
    const lastDayOfMonth = new Date(y, m, 0).getDate()
    if (Number(maxDate.slice(8, 10)) !== lastDayOfMonth) return true
  }

  return false
}

export function defaultDateForMonth(month: string, today: Date): string {
  const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  if (month === todayMonth) {
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  }
  return `${month}-01`
}

export function searchEntries(transactions: Transaction[], query: string): Transaction[] {
  const q = query.trim().toLowerCase()
  if (!q) return transactions
  return transactions.filter((t) => t.content.toLowerCase().includes(q) || (t.memo ?? '').toLowerCase().includes(q))
}

export type SortField = 'date' | 'amount'
export type SortDirection = 'asc' | 'desc'

export function sortEntries(transactions: Transaction[], field: SortField, direction: SortDirection): Transaction[] {
  return [...transactions].sort((a, b) => {
    if (field === 'date') {
      const cmp = `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)
      return direction === 'asc' ? cmp : -cmp
    }
    const diff = a.amount - b.amount
    return direction === 'asc' ? diff : -diff
  })
}

export function applyEntryFieldPatch(
  section: EntrySection,
  key: EntryColumnKey,
  value: string | number
): Partial<Transaction> {
  if (key === 'amount') {
    const magnitude = Math.abs(Number(value))
    return { amount: section === 'income' ? magnitude : -magnitude }
  }
  if (key === 'category') {
    return section === 'spending' ? { category: String(value), subcategory: '미분류' } : { category: String(value) }
  }
  if (key === 'date') return { date: String(value) }
  if (key === 'content') return { content: String(value) }
  if (key === 'subcategory') return { subcategory: String(value) }
  return { paymentMethod: String(value) }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS — all `entriesLogic.test.ts` cases green, no other suite broken.

- [ ] **Step 5: Commit**

```bash
git add src/lib/entriesLogic.ts src/lib/entriesLogic.test.ts
git commit -m "feat: entries screen filtering/sorting/patch logic"
```

---

### Task 2: Category dropdown sources for income/saving sections (`src/lib/categories.ts`)

**Files:**
- Modify: `src/lib/categories.ts`
- Modify: `src/lib/categories.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (consumed by Task 6): `SEED_SAVING_CATEGORIES`, `mergeObservedFlatList(seed, observed)`. `mergeObservedPaymentMethods` keeps its exact existing signature/behavior (now implemented in terms of `mergeObservedFlatList`).

- [ ] **Step 1: Write the failing tests**

In `src/lib/categories.test.ts`, change the import line to also pull in the new export and `SEED_INCOME_CATEGORIES`:

```ts
import {
  SEED_EXPENSE_CATEGORIES,
  SEED_INCOME_CATEGORIES,
  SEED_PAYMENT_METHODS,
  mergeObservedCategories,
  mergeObservedFlatList,
  mergeObservedPaymentMethods,
} from './categories'
```

Append at the end of the file:

```ts
describe('mergeObservedFlatList', () => {
  it('includes every seed value', () => {
    const merged = mergeObservedFlatList(SEED_INCOME_CATEGORIES, [])
    for (const category of SEED_INCOME_CATEGORIES) {
      expect(merged).toContain(category)
    }
  })

  it('adds a new observed value not in the seed list', () => {
    const merged = mergeObservedFlatList(SEED_INCOME_CATEGORIES, ['환급금'])
    expect(merged).toContain('환급금')
  })

  it('does not duplicate an observed value already in the seed list', () => {
    const merged = mergeObservedFlatList(SEED_INCOME_CATEGORIES, ['급여'])
    expect(merged.filter((c) => c === '급여')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `mergeObservedFlatList` is not exported from `./categories` yet.

- [ ] **Step 3: Implement the changes in `src/lib/categories.ts`**

Add `SEED_SAVING_CATEGORIES` under the existing `SEED_TRANSFER_CATEGORIES` export (line 3):

```ts
export const SEED_SAVING_CATEGORIES = ['투자', '청약저축', '적금', '증권/투자', '기타']
```

Replace the existing `mergeObservedPaymentMethods` function with a generic helper plus a thin wrapper that preserves the exact same external signature/behavior:

```ts
export function mergeObservedFlatList(seed: string[], observed: string[]): string[] {
  const merged = new Set([...seed, ...observed])
  return [...merged].sort()
}

export function mergeObservedPaymentMethods(observed: string[]): string[] {
  return mergeObservedFlatList(SEED_PAYMENT_METHODS, observed)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS — new `mergeObservedFlatList` tests green, existing `mergeObservedPaymentMethods`/`mergeObservedCategories` tests still green (behavior unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/lib/categories.ts src/lib/categories.test.ts
git commit -m "feat: add saving category seed list and generic flat-list category merge"
```

---

### Task 3: Reusable inline-edit primitives (`EditableSelect`, `AmountInput`)

**Files:**
- Create: `src/components/entries/EditableSelect.tsx`
- Create: `src/components/entries/AmountInput.tsx`

**Interfaces:**
- Consumes: nothing project-specific (pure presentational components, React only).
- Produces (consumed by Task 4): `EditableSelect` (props: `{ value: string, options: string[], onChange: (value: string) => void, className?: string }`) and `AmountInput` (props: `{ value: number, onChange: (value: number) => void, className?: string }`, where `value`/`onChange` are always a non-negative magnitude, per the Global Constraints amount-input decision).

No test file — matches the established no-component-test pattern already used for every other `.tsx` file in this project (verified via `tsc`, not Vitest).

- [ ] **Step 1: Create `src/components/entries/EditableSelect.tsx`**

```tsx
import { useState } from 'react'

const CUSTOM_OPTION = '__custom__'

interface EditableSelectProps {
  value: string
  options: string[]
  onChange: (value: string) => void
  className?: string
}

export default function EditableSelect({ value, options, onChange, className }: EditableSelectProps) {
  const [customMode, setCustomMode] = useState(false)
  const [draft, setDraft] = useState(value)

  const allOptions = value && !options.includes(value) ? [value, ...options] : options

  function commitCustom() {
    setCustomMode(false)
    const trimmed = draft.trim()
    if (trimmed) onChange(trimmed)
  }

  if (customMode) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitCustom}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitCustom()
          if (e.key === 'Escape') setCustomMode(false)
        }}
        className={className ?? 'w-full rounded border px-2 py-1 text-sm'}
      />
    )
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === CUSTOM_OPTION) {
          setDraft(value)
          setCustomMode(true)
          return
        }
        onChange(e.target.value)
      }}
      className={className ?? 'w-full rounded border px-2 py-1 text-sm'}
    >
      {!value && <option value="">선택</option>}
      {allOptions.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
      <option value={CUSTOM_OPTION}>+ 직접 입력</option>
    </select>
  )
}
```

- [ ] **Step 2: Create `src/components/entries/AmountInput.tsx`**

```tsx
import { useState } from 'react'

interface AmountInputProps {
  value: number
  onChange: (value: number) => void
  className?: string
}

function toDigits(raw: string): number {
  const digitsOnly = raw.replace(/[^0-9]/g, '')
  return digitsOnly ? Number(digitsOnly) : 0
}

export default function AmountInput({ value, onChange, className }: AmountInputProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(value))
          setEditing(true)
        }}
        className={className ?? 'w-full rounded px-2 py-1 text-right text-sm hover:bg-slate-50'}
      >
        {value.toLocaleString('ko-KR')}
      </button>
    )
  }

  function commit() {
    setEditing(false)
    onChange(toDigits(draft))
  }

  return (
    <input
      autoFocus
      inputMode="numeric"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setEditing(false)
      }}
      className={className ?? 'w-full rounded border px-2 py-1 text-right text-sm'}
    />
  )
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: PASS — no `tsc` errors (both files are unused by anything yet, so this only checks they compile standalone).

- [ ] **Step 4: Commit**

```bash
git add src/components/entries/EditableSelect.tsx src/components/entries/AmountInput.tsx
git commit -m "feat: inline-edit select and amount input primitives for entries table"
```

---

### Task 4: Generic entries table (`EntriesTable`)

**Files:**
- Create: `src/components/entries/EntriesTable.tsx`

**Interfaces:**
- Consumes: `EntryColumnKey`, `SortField`, `SortDirection` (`src/lib/entriesLogic.ts`, Task 1), `Transaction` (`src/types/transaction.ts`), `formatKRW` (`src/lib/format.ts`), `EditableSelect`/`AmountInput` (Task 3).
- Produces (consumed by Task 6): `EntriesTable` component and its exported `EntryColumnDef` type: `{ key: EntryColumnKey, label: string, type: 'date' | 'text' | 'select' | 'amount', options?: string[] | ((row: Transaction) => string[]) }`.

No test file (same rationale as Task 3).

- [ ] **Step 1: Create `src/components/entries/EntriesTable.tsx`**

```tsx
import type { Transaction } from '../../types/transaction'
import { formatKRW } from '../../lib/format'
import type { EntryColumnKey, SortDirection, SortField } from '../../lib/entriesLogic'
import EditableSelect from './EditableSelect'
import AmountInput from './AmountInput'

export interface EntryColumnDef {
  key: EntryColumnKey
  label: string
  type: 'date' | 'text' | 'select' | 'amount'
  options?: string[] | ((row: Transaction) => string[])
}

interface EntriesTableProps {
  columns: EntryColumnDef[]
  rows: Transaction[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onBulkDelete: () => void
  onDeleteRow: (id: string) => void
  onEditField: (id: string, key: EntryColumnKey, value: string | number) => void
  sortField: SortField
  sortDirection: SortDirection
  onSortChange: (field: SortField) => void
  totalAmount: number
  draftRow: Transaction | null
  onDraftChange: (key: EntryColumnKey, value: string | number) => void
  onDraftSave: () => void
  onDraftCancel: () => void
  onStartDraft: () => void
  overrideAction?: { label: (row: Transaction) => string; onClick: (row: Transaction) => void }
}

function resolveOptions(col: EntryColumnDef, row: Transaction): string[] {
  if (typeof col.options === 'function') return col.options(row)
  return col.options ?? []
}

function EditableCell({
  col,
  row,
  onChange,
}: {
  col: EntryColumnDef
  row: Transaction
  onChange: (key: EntryColumnKey, value: string | number) => void
}) {
  if (col.type === 'date') {
    return (
      <input
        type="date"
        value={row.date}
        onChange={(e) => onChange('date', e.target.value)}
        className="w-full rounded border px-2 py-1 text-sm"
      />
    )
  }
  if (col.type === 'text') {
    return (
      <input
        type="text"
        value={row.content}
        onChange={(e) => onChange('content', e.target.value)}
        className="w-full rounded border px-2 py-1 text-sm"
      />
    )
  }
  if (col.type === 'select') {
    return (
      <EditableSelect
        value={row[col.key] as string}
        options={resolveOptions(col, row)}
        onChange={(value) => onChange(col.key, value)}
      />
    )
  }
  return <AmountInput value={Math.abs(row.amount)} onChange={(value) => onChange('amount', value)} />
}

export default function EntriesTable({
  columns,
  rows,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onBulkDelete,
  onDeleteRow,
  onEditField,
  sortField,
  sortDirection,
  onSortChange,
  totalAmount,
  draftRow,
  onDraftChange,
  onDraftSave,
  onDraftCancel,
  onStartDraft,
  overrideAction,
}: EntriesTableProps) {
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id))

  return (
    <div className="overflow-x-auto rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={onBulkDelete}
          disabled={selectedIds.size === 0}
          className="rounded-lg bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-600 disabled:opacity-40"
        >
          선택 삭제 ({selectedIds.size})
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            <th className="w-8 pb-2">
              <input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} />
            </th>
            {columns.map((col) => (
              <th key={col.key} className="pb-2 pr-4">
                {col.type === 'date' || col.type === 'amount' ? (
                  <button
                    onClick={() => onSortChange(col.key as SortField)}
                    className="font-medium hover:text-slate-800"
                  >
                    {col.label} {sortField === col.key ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
            <th className="w-24 pb-2">작업</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="py-1.5">
                <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => onToggleSelect(row.id)} />
              </td>
              {columns.map((col) => (
                <td key={col.key} className="py-1.5 pr-4">
                  <EditableCell col={col} row={row} onChange={(key, value) => onEditField(row.id, key, value)} />
                </td>
              ))}
              <td className="py-1.5">
                <div className="flex items-center gap-2">
                  {overrideAction && (
                    <button
                      onClick={() => overrideAction.onClick(row)}
                      className="text-xs text-slate-400 hover:text-blue-600"
                    >
                      {overrideAction.label(row)}
                    </button>
                  )}
                  <button onClick={() => onDeleteRow(row.id)} className="text-xs text-slate-400 hover:text-rose-600">
                    삭제
                  </button>
                </div>
              </td>
            </tr>
          ))}

          {draftRow && (
            <tr className="border-b bg-blue-50/40 last:border-0">
              <td className="py-1.5" />
              {columns.map((col) => (
                <td key={col.key} className="py-1.5 pr-4">
                  <EditableCell col={col} row={draftRow} onChange={onDraftChange} />
                </td>
              ))}
              <td className="py-1.5">
                <div className="flex items-center gap-2">
                  <button onClick={onDraftSave} className="text-xs font-medium text-blue-600">
                    저장
                  </button>
                  <button onClick={onDraftCancel} className="text-xs text-slate-400">
                    취소
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {!draftRow && (
        <button
          onClick={onStartDraft}
          className="mt-3 w-full rounded-lg border border-dashed py-2 text-sm text-slate-500 hover:bg-slate-50"
        >
          + 추가
        </button>
      )}

      <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm font-medium text-slate-700">
        <span>합계 ({rows.length}건)</span>
        <span>{formatKRW(totalAmount)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: PASS — no `tsc` errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/entries/EntriesTable.tsx
git commit -m "feat: generic column-config-driven entries table with inline edit, add/delete, sort, totals"
```

---

### Task 5: Section tabs + filter toolbar (`EntriesToolbar`)

**Files:**
- Create: `src/components/entries/EntriesToolbar.tsx`

**Interfaces:**
- Consumes: `EntrySection` (`src/lib/entriesLogic.ts`, Task 1).
- Produces (consumed by Task 6): `EntriesToolbar` component.

No test file (same rationale as Task 3).

- [ ] **Step 1: Create `src/components/entries/EntriesToolbar.tsx`**

```tsx
import { ENTRY_SECTIONS, ENTRY_SECTION_LABELS, type EntrySection } from '../../lib/entriesLogic'

interface EntriesToolbarProps {
  section: EntrySection
  onSectionChange: (section: EntrySection) => void
  month: string
  availableMonths: string[]
  isPartial: boolean
  onMonthChange: (month: string) => void
  search: string
  onSearchChange: (value: string) => void
  categoryFilter: string
  categoryOptions: string[]
  onCategoryFilterChange: (value: string) => void
  paymentMethodFilter: string
  paymentMethodOptions: string[]
  onPaymentMethodFilterChange: (value: string) => void
}

export default function EntriesToolbar({
  section,
  onSectionChange,
  month,
  availableMonths,
  isPartial,
  onMonthChange,
  search,
  onSearchChange,
  categoryFilter,
  categoryOptions,
  onCategoryFilterChange,
  paymentMethodFilter,
  paymentMethodOptions,
  onPaymentMethodFilterChange,
}: EntriesToolbarProps) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-4 flex gap-2">
        {ENTRY_SECTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSectionChange(s)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              section === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {ENTRY_SECTION_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-800"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {isPartial && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
              일부 기간
            </span>
          )}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="내용/메모 검색"
          className="rounded-lg border px-3 py-1.5 text-sm"
        />

        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-sm"
        >
          <option value="ALL">전체 카테고리</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={paymentMethodFilter}
          onChange={(e) => onPaymentMethodFilterChange(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-sm"
        >
          <option value="ALL">전체 결제수단</option>
          {paymentMethodOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: PASS — no `tsc` errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/entries/EntriesToolbar.tsx
git commit -m "feat: entries screen section tabs and month/search/category/payment filter toolbar"
```

---

### Task 6: Wire up `EntriesPage`, `addTransaction` store method, and routing

**Files:**
- Create: `src/pages/EntriesPage.tsx`
- Modify: `src/store/useTransactionStore.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/AppShell.tsx`

**Interfaces:**
- Consumes: everything produced by Tasks 1-5, plus existing `useTransactionStore` (`transactions`, `updateTransaction`, `deleteTransaction`, `setOverride`), `listAvailableMonths` (`src/lib/aggregations.ts`), `computeTransactionId` (`src/lib/idHash.ts`), `SEED_EXPENSE_CATEGORIES`/`SEED_INCOME_CATEGORIES`/`SEED_SAVING_CATEGORIES`/`SEED_PAYMENT_METHODS`/`mergeObservedCategories`/`mergeObservedFlatList`/`mergeObservedPaymentMethods` (`src/lib/categories.ts`).
- Produces: the `/entries` route, reachable from the nav bar.

No test file (page composition, same rationale as Task 3; verified via `tsc` + manual browser smoke test in Step 6).

- [ ] **Step 1: Add `addTransaction` to the store**

In `src/store/useTransactionStore.ts`, add `addTransaction` to the `TransactionStoreState` interface, right after `importRows`:

```ts
  addTransaction: (transaction: Transaction) => Promise<void>
```

Add the implementation right after the `importRows` method body (before `updateTransaction`):

```ts
  async addTransaction(transaction) {
    const { error } = await supabase.from('transactions').insert(transactionToRow(transaction))
    if (error) throw error
    set({ transactions: [...get().transactions, transaction] })
  },
```

- [ ] **Step 2: Create `src/pages/EntriesPage.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import EntriesToolbar from '../components/entries/EntriesToolbar'
import EntriesTable, { type EntryColumnDef } from '../components/entries/EntriesTable'
import { useTransactionStore } from '../store/useTransactionStore'
import { listAvailableMonths } from '../lib/aggregations'
import {
  applyEntryFieldPatch,
  defaultDateForMonth,
  filterByMonth,
  filterBySection,
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
  SEED_SAVING_CATEGORIES,
  mergeObservedCategories,
  mergeObservedFlatList,
  mergeObservedPaymentMethods,
} from '../lib/categories'
import type { Transaction } from '../types/transaction'

function createDraft(section: EntrySection, month: string): Transaction {
  return {
    id: '__draft__',
    date: defaultDateForMonth(month, new Date()),
    time: '12:00:00',
    type: section === 'income' ? '수입' : section === 'saving' ? '이체' : '지출',
    category:
      section === 'income'
        ? SEED_INCOME_CATEGORIES[0]
        : section === 'saving'
          ? SEED_SAVING_CATEGORIES[0]
          : Object.keys(SEED_EXPENSE_CATEGORIES)[0],
    subcategory: '미분류',
    content: '',
    amount: 0,
    currency: 'KRW',
    paymentMethod: SEED_PAYMENT_METHODS[0],
    memo: null,
    flowType: section,
    flowTypeOverride: section === 'income' ? null : section,
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

  useEffect(() => {
    if (!month && availableMonths.length > 0) {
      setMonth(availableMonths[availableMonths.length - 1])
    }
  }, [availableMonths, month])

  useEffect(() => {
    setCategoryFilter('ALL')
    setPaymentMethodFilter('ALL')
    setSelectedIds(new Set())
    setDraft(null)
  }, [section])

  const sectionRows = useMemo(() => filterBySection(transactions, section), [transactions, section])
  const monthRows = useMemo(() => filterByMonth(sectionRows, month), [sectionRows, month])
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

  const categoryFilterOptions = useMemo(() => [...new Set(sectionRows.map((t) => t.category))].sort(), [sectionRows])
  const paymentMethodFilterOptions = useMemo(
    () => [...new Set(sectionRows.map((t) => t.paymentMethod))].sort(),
    [sectionRows]
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
  const savingCategoryOptions = useMemo(
    () =>
      mergeObservedFlatList(SEED_SAVING_CATEGORIES, filterBySection(transactions, 'saving').map((t) => t.category)),
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
    if (section === 'saving') {
      return [
        { key: 'date', label: '날짜', type: 'date' },
        { key: 'paymentMethod', label: '계좌', type: 'select', options: paymentMethodOptions },
        { key: 'category', label: '구분', type: 'select', options: savingCategoryOptions },
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
  }, [section, paymentMethodOptions, incomeCategoryOptions, savingCategoryOptions, expenseCategories])

  const overrideAction =
    section === 'spending'
      ? {
          label: (row: Transaction) => (row.flowTypeOverride === 'spending' ? '자동 분류로' : '저축으로 전환'),
          onClick: (row: Transaction) => setOverride(row.id, row.flowTypeOverride === 'spending' ? null : 'saving'),
        }
      : section === 'saving'
        ? {
            label: (row: Transaction) => (row.flowTypeOverride === 'saving' ? '자동 분류로' : '지출로 전환'),
            onClick: (row: Transaction) => setOverride(row.id, row.flowTypeOverride === 'saving' ? null : 'spending'),
          }
        : undefined

  function handleEditField(id: string, key: EntryColumnKey, value: string | number) {
    updateTransaction(id, applyEntryFieldPatch(section, key, value))
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
    await addTransaction({ ...draft, id })
    setDraft(null)
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
    await Promise.all([...selectedIds].map((id) => deleteTransaction(id)))
    setSelectedIds(new Set())
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

      <EntriesToolbar
        section={section}
        onSectionChange={setSection}
        month={month}
        availableMonths={availableMonths}
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
      />

      <div className="mt-4">
        <EntriesTable
          columns={columns}
          rows={sortedRows}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onBulkDelete={handleBulkDelete}
          onDeleteRow={deleteTransaction}
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

- [ ] **Step 3: Wire the `/entries` route into `src/App.tsx`**

Add the import alongside the other page imports:

```tsx
import EntriesPage from './pages/EntriesPage'
```

Add the route inside `<Routes>`, alongside the existing routes:

```tsx
          <Route path="/entries" element={<EntriesPage />} />
```

- [ ] **Step 4: Add the nav link in `src/components/AppShell.tsx`**

Change `navItems` to:

```tsx
const navItems = [
  { to: '/', label: '대시보드', end: true },
  { to: '/entries', label: '거래 관리', end: false },
  { to: '/import', label: '불러오기', end: false },
]
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: PASS — no `tsc` errors. Then run `npm run test` and confirm the full suite (all prior + Task 1/2 additions) is still green.

- [ ] **Step 6: Manual browser smoke test**

Run: `npm run dev`, log in, navigate to `/entries`, and verify by hand:
- All 3 tabs render with the correct column sets (수입: 5 cols, 저축·투자: 5 cols, 지출: 6 cols including 소분류).
- Switching months changes the visible rows; the earliest/latest month in the dataset shows the "일부 기간" badge.
- Clicking a category cell shows a dropdown with a working "+ 직접 입력" custom option.
- Editing an amount, saving, and reloading the page (`fetchAll` on mount) shows the persisted value.
- "+ 추가" creates a draft row; filling content + amount and clicking 저장 adds a new transaction that appears in the correct tab.
- Selecting rows and clicking "선택 삭제" removes them; a single row's 삭제 button also works.
- On the 지출 tab, "저축으로 전환" on a row moves it to the 저축·투자 tab; that tab's row can be toggled back with "지출로 전환" (or "자동 분류로" if it came from an automatic classification origin).
- Search and category/payment-method filters narrow the visible rows and the footer total updates accordingly.

Report the outcome (pass/fail per bullet) before moving to code review.

- [ ] **Step 7: Commit**

```bash
git add src/pages/EntriesPage.tsx src/store/useTransactionStore.ts src/App.tsx src/components/AppShell.tsx
git commit -m "feat: entries page — tabs, month/search/category/payment filters, inline CRUD, override toggle"
```

---
