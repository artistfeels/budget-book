# Budget Book — Foundation (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the foundation of the personal budget app: project scaffold, Supabase schema + Google auth, the pure data layer (Excel parsing, transfer-pair matching, flow-type classification, aggregations) with unit tests, a Zustand store wired to Supabase, and an Import page that gets real data from the sample Excel file into the database end-to-end.

**Architecture:** React 18 + TypeScript + Vite + Tailwind frontend, deployed later to Vercel. No custom backend — the browser talks directly to Supabase (Postgres + Auth) via `@supabase/supabase-js`, protected by Row Level Security. Zustand holds an in-memory cache of the signed-in user's transactions, loaded once at startup and kept in sync via write-through on every mutation. All classification/matching/aggregation logic is pure and unit-tested; Supabase/network glue code is verified by a manual run-through instead of mocked unit tests.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Zustand, Recharts (installed now, used from Phase 2), date-fns, SheetJS (`xlsx`), `@supabase/supabase-js`, Vitest, react-router-dom, Pretendard (CDN font).

## Global Constraints

- Design doc: `docs/superpowers/specs/2026-07-19-budget-book-design.md` — every requirement below traces back to it; read it if a task references "the design doc."
- Sample data file: `data/2025-07-19~2026-07-19.xlsx`, sheet `가계부 내역`, headers `날짜,시간,타입,대분류,소분류,내용,금액,화폐,결제수단,메모`. `data/` is gitignored — never commit files under it.
- Excel date/time columns are **serial numbers**, not JS Dates. Do NOT read the workbook with `{ cellDates: true }` — verified during design to introduce a timezone bug that shifts the calendar date. Always convert manually (exact formula in Task 6).
- Transaction amounts are signed exactly as SheetJS returns them from the source file — never force a sign based on `타입`. This intentionally lets refund/cancellation rows (positive amount on a `지출` row) net out correctly when summed.
- `이체` type transactions are never counted as income or spending, no matter the category — always resolve to `flowType: 'neutral'` unless a higher-priority rule (saving payment method, 투자 출금) applies first.
- Node version available: v24.16.0 (has global Web Crypto — `crypto.subtle` works with no extra dependency).
- Git repo already initialized at project root with `origin` = `https://github.com/artistfeels/budget-book.git`, local user configured as `artistfeels <s0714488@gmail.com>`. Commit after every task per the steps below.

---

### Task 1: Project scaffold (Vite + React + TS + Tailwind)

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`
- Create: `.env.example`

**Interfaces:**
- Produces: `npm run dev` (Vite dev server), `npm run build`, `npm run test` (Vitest, wired in Task 2), Tailwind utility classes available in all components, Pretendard as the default `font-sans`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "budget-book",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "date-fns": "^3.6.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0",
    "recharts": "^2.12.0",
    "xlsx": "^0.18.5",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "jsdom": "^24.1.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 5: Create `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'system-ui', 'sans-serif'],
      },
      colors: {
        income: '#2563eb',
        spending: '#e11d48',
        saving: '#059669',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 6: Create `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 7: Create `index.html`**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>가계부</title>
    <link
      rel="stylesheet"
      as="style"
      crossorigin
      href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Create `src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: 'Pretendard', system-ui, sans-serif;
}
```

- [ ] **Step 9: Create `src/App.tsx`**

```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-2xl font-bold text-slate-800">가계부</h1>
    </div>
  )
}
```

- [ ] **Step 10: Create `src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 11: Create `.env.example`**

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 12: Install dependencies**

Run: `npm install`
Expected: exits 0, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 13: Verify the dev server boots**

Run: `npm run dev -- --port 5173 &` then `curl -sS http://localhost:5173 | head -c 200` (or open the URL in a browser), then stop the dev server.
Expected: HTML response containing `<div id="root">`, no console errors.

- [ ] **Step 14: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts tailwind.config.js postcss.config.js index.html src/main.tsx src/App.tsx src/index.css .env.example
git commit -m "chore: scaffold Vite + React + TS + Tailwind project"
```

---

### Task 2: Vitest smoke test

**Files:**
- Create: `src/lib/smoke.test.ts`

**Interfaces:**
- Produces: confirms `npm run test` works before any real logic is written.

- [ ] **Step 1: Write a trivial test**

```ts
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 2: Run it**

Run: `npm run test`
Expected: `1 passed`

- [ ] **Step 3: Delete the smoke test (it's served its purpose)**

Run: `rm src/lib/smoke.test.ts` (bash) or `Remove-Item src/lib/smoke.test.ts` (PowerShell)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: verify vitest setup"
```

---

### Task 3: Transaction & rule types

**Files:**
- Create: `src/types/transaction.ts`

**Interfaces:**
- Produces: `TransactionType`, `FlowType`, `Transaction`, `ClassificationRule` — used by every task from here on.

- [ ] **Step 1: Create the file**

```ts
export type TransactionType = '수입' | '지출' | '이체'
export type FlowType = 'income' | 'saving' | 'spending' | 'neutral'

export interface Transaction {
  id: string
  date: string // YYYY-MM-DD
  time: string // HH:MM:SS
  type: TransactionType
  category: string
  subcategory: string
  content: string
  amount: number // signed, trusted as-is from source
  currency: string
  paymentMethod: string
  memo: string | null
  flowType: FlowType
  flowTypeOverride: 'saving' | 'spending' | null
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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/transaction.ts
git commit -m "feat: add Transaction and ClassificationRule types"
```

---

### Task 4: Deterministic transaction ID hashing

**Files:**
- Create: `src/lib/idHash.ts`
- Test: `src/lib/idHash.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `computeTransactionId(fields): Promise<string>` — used by the Excel parser pipeline (Task 12) to give every imported row a stable primary key.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { computeTransactionId } from './idHash'

const base = {
  date: '2026-07-18',
  time: '23:34:36',
  type: '이체' as const,
  category: '내계좌이체',
  subcategory: '미분류',
  content: '네이버페이충전',
  amount: -120000,
  paymentMethod: 'NH주거래우대통장',
}

describe('computeTransactionId', () => {
  it('is deterministic for identical input', async () => {
    const id1 = await computeTransactionId(base)
    const id2 = await computeTransactionId(base)
    expect(id1).toBe(id2)
    expect(id1).toHaveLength(64)
  })

  it('differs when amount differs', async () => {
    const id1 = await computeTransactionId(base)
    const id2 = await computeTransactionId({ ...base, amount: -120001 })
    expect(id1).not.toBe(id2)
  })

  it('differs when content differs', async () => {
    const id1 = await computeTransactionId(base)
    const id2 = await computeTransactionId({ ...base, content: '다른 내용' })
    expect(id1).not.toBe(id2)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- idHash`
Expected: FAIL — `Cannot find module './idHash'`

- [ ] **Step 3: Implement**

```ts
export interface TransactionIdFields {
  date: string
  time: string
  type: string
  category: string
  subcategory: string
  content: string
  amount: number
  paymentMethod: string
}

export async function computeTransactionId(fields: TransactionIdFields): Promise<string> {
  const raw = [
    fields.date,
    fields.time,
    fields.type,
    fields.category,
    fields.subcategory,
    fields.content,
    String(fields.amount),
    fields.paymentMethod,
  ].join('|')

  const data = new TextEncoder().encode(raw)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- idHash`
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/idHash.ts src/lib/idHash.test.ts
git commit -m "feat: deterministic transaction id hashing"
```

---

### Task 5: Currency/amount formatting

**Files:**
- Create: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `formatKRW(amount): string`, `formatManwon(amount): string` — used throughout the UI from Phase 2 on.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { formatKRW, formatManwon } from './format'

describe('formatKRW', () => {
  it('formats positive amounts with 원 suffix and comma grouping', () => {
    expect(formatKRW(1234567)).toBe('1,234,567원')
  })

  it('formats negative amounts with a leading minus', () => {
    expect(formatKRW(-5000)).toBe('-5,000원')
  })

  it('formats zero', () => {
    expect(formatKRW(0)).toBe('0원')
  })
})

describe('formatManwon', () => {
  it('abbreviates to 만원 with one decimal', () => {
    expect(formatManwon(1234000)).toBe('123.4만원')
  })

  it('drops trailing .0', () => {
    expect(formatManwon(1230000)).toBe('123만원')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- format`
Expected: FAIL — `Cannot find module './format'`

- [ ] **Step 3: Implement**

```ts
export function formatKRW(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  return `${sign}${Math.abs(amount).toLocaleString('ko-KR')}원`
}

export function formatManwon(amount: number): string {
  const manwon = amount / 10000
  return `${manwon.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만원`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- format`
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat: KRW currency formatting helpers"
```

---

### Task 6: Excel parser (header-mapped, sheet auto-detection)

**Files:**
- Create: `src/lib/excelParser.ts`
- Test: `src/lib/excelParser.test.ts`

**Interfaces:**
- Consumes: `TransactionType` from `src/types/transaction.ts`.
- Produces: `ParsedRawRow` type, `findTargetSheet(workbook): string`, `parseWorkbook(workbook): ParsedRawRow[]` — consumed by the Import page (Task 14) and the Zustand store (Task 12).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { findTargetSheet, parseWorkbook } from './excelParser'

function buildWorkbook(sheetName: string, headers: string[], rows: unknown[][]) {
  const wb = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  XLSX.utils.book_append_sheet(wb, sheet, sheetName)
  return wb
}

describe('findTargetSheet', () => {
  it('prefers the 가계부 내역 sheet name', () => {
    const wb = buildWorkbook('가계부 내역', ['날짜', '시간', '타입', '금액'], [[46222, 0.5, '지출', -1000]])
    expect(findTargetSheet(wb)).toBe('가계부 내역')
  })

  it('falls back to any sheet with the required headers', () => {
    const wb = buildWorkbook('Sheet1', ['날짜', '타입', '대분류', '금액'], [[46222, '지출', '식비', -1000]])
    expect(findTargetSheet(wb)).toBe('Sheet1')
  })

  it('throws when no sheet has the required headers', () => {
    const wb = buildWorkbook('Sheet1', ['A', 'B'], [[1, 2]])
    expect(() => findTargetSheet(wb)).toThrow()
  })
})

describe('parseWorkbook', () => {
  const headers = ['날짜', '시간', '타입', '대분류', '소분류', '내용', '금액', '화폐', '결제수단', '메모']

  it('converts excel date/time serials correctly and maps by header name', () => {
    const wb = buildWorkbook('가계부 내역', headers, [
      [46221, 0.9823611111111111, '이체', '내계좌이체', '미분류', '네이버페이충전', -120000, 'KRW', 'NH주거래우대통장', null],
    ])
    const [row] = parseWorkbook(wb)
    expect(row).toEqual({
      date: '2026-07-18',
      time: '23:34:36',
      type: '이체',
      category: '내계좌이체',
      subcategory: '미분류',
      content: '네이버페이충전',
      amount: -120000,
      currency: 'KRW',
      paymentMethod: 'NH주거래우대통장',
      memo: null,
    })
  })

  it('is unaffected by column reordering', () => {
    const reordered = ['타입', '날짜', '금액', '시간', '대분류', '소분류', '내용', '결제수단', '화폐', '메모']
    const wb = buildWorkbook('가계부 내역', reordered, [
      ['수입', 46200, 37484, 0.25, '금융수입', '미분류', '결산이자', 'OK파킹플렉스통장', 'KRW', null],
    ])
    const [row] = parseWorkbook(wb)
    expect(row.type).toBe('수입')
    expect(row.amount).toBe(37484)
    expect(row.paymentMethod).toBe('OK파킹플렉스통장')
    expect(row.date).toBe('2026-06-27') // serial 46200 = 21 days before the 46221 anchor used above (2026-07-18)
  })

  it('defaults missing 소분류 to 미분류 and empty 메모 to null', () => {
    const wb = buildWorkbook('가계부 내역', headers, [
      [46221, 0.5, '지출', '기타', null, '테스트', -100, 'KRW', '토스 간편결제', null],
    ])
    const [row] = parseWorkbook(wb)
    expect(row.subcategory).toBe('미분류')
    expect(row.memo).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- excelParser`
Expected: FAIL — `Cannot find module './excelParser'`

- [ ] **Step 3: Implement**

```ts
import * as XLSX from 'xlsx'
import type { TransactionType } from '../types/transaction'

export interface ParsedRawRow {
  date: string
  time: string
  type: TransactionType
  category: string
  subcategory: string
  content: string
  amount: number
  currency: string
  paymentMethod: string
  memo: string | null
}

const PREFERRED_SHEET_NAME = '가계부 내역'
const REQUIRED_HEADERS = ['날짜', '타입', '금액']

export function findTargetSheet(workbook: XLSX.WorkBook): string {
  if (workbook.SheetNames.includes(PREFERRED_SHEET_NAME)) {
    return PREFERRED_SHEET_NAME
  }
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
    const header = (rows[0] ?? []) as string[]
    if (REQUIRED_HEADERS.every((h) => header.includes(h))) {
      return name
    }
  }
  throw new Error('가계부 데이터가 있는 시트를 찾을 수 없습니다 (날짜/타입/금액 헤더 필요).')
}

// Excel serial-date epoch is 1899-12-30 (accounts for the Lotus 1-2-3 leap-year bug).
// Do NOT use XLSX's `cellDates: true` — verified during design to shift the calendar
// date by applying a timezone offset. Convert the raw serial manually instead.
function excelSerialToDateString(serial: number): string {
  const wholeDays = Math.round(serial)
  const utcMs = Date.UTC(1899, 11, 30) + wholeDays * 86400000
  const d = new Date(utcMs)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function excelFractionToTimeString(frac: number): string {
  const totalSeconds = Math.round(frac * 86400)
  const hh = String(Math.floor(totalSeconds / 3600) % 24).padStart(2, '0')
  const mm = String(Math.floor(totalSeconds / 60) % 60).padStart(2, '0')
  const ss = String(totalSeconds % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function parseWorkbook(workbook: XLSX.WorkBook): ParsedRawRow[] {
  const sheetName = findTargetSheet(workbook)
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })

  return rows.map((row) => ({
    date: excelSerialToDateString(Number(row['날짜'])),
    time: excelFractionToTimeString(Number(row['시간'] ?? 0)),
    type: row['타입'] as TransactionType,
    category: String(row['대분류'] ?? '미분류'),
    subcategory: row['소분류'] ? String(row['소분류']) : '미분류',
    content: String(row['내용'] ?? ''),
    amount: Number(row['금액']),
    currency: String(row['화폐'] ?? 'KRW'),
    paymentMethod: String(row['결제수단'] ?? ''),
    memo: row['메모'] ? String(row['메모']) : null,
  }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- excelParser`
Expected: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/excelParser.ts src/lib/excelParser.test.ts
git commit -m "feat: header-mapped excel parser with sheet auto-detection"
```

---

### Task 7: Category / subcategory / payment method seed lists

**Files:**
- Create: `src/lib/categories.ts`
- Test: `src/lib/categories.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `SEED_INCOME_CATEGORIES`, `SEED_TRANSFER_CATEGORIES`, `SEED_EXPENSE_CATEGORIES`, `SEED_PAYMENT_METHODS`, `mergeObservedPaymentMethods(observed): string[]`, `mergeObservedCategories(seed, observed): Record<string, string[]>` — used by the Entries page (Phase 4) and Import preview (Task 14) to build dropdown option lists that auto-extend with new values.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { SEED_EXPENSE_CATEGORIES, SEED_PAYMENT_METHODS, mergeObservedCategories, mergeObservedPaymentMethods } from './categories'

describe('mergeObservedPaymentMethods', () => {
  it('includes all seed methods', () => {
    const merged = mergeObservedPaymentMethods([])
    for (const method of SEED_PAYMENT_METHODS) {
      expect(merged).toContain(method)
    }
  })

  it('adds a new observed method not in the seed list', () => {
    const merged = mergeObservedPaymentMethods(['새로운 카드'])
    expect(merged).toContain('새로운 카드')
  })

  it('does not duplicate an observed method already in the seed list', () => {
    const merged = mergeObservedPaymentMethods(['삼성카드 taptap O'])
    expect(merged.filter((m) => m === '삼성카드 taptap O')).toHaveLength(1)
  })
})

describe('mergeObservedCategories', () => {
  it('adds a new subcategory under an existing category', () => {
    const merged = mergeObservedCategories(SEED_EXPENSE_CATEGORIES, [{ category: '식비', subcategory: '분식' }])
    expect(merged['식비']).toContain('분식')
  })

  it('creates a new category when an observed category is unknown', () => {
    const merged = mergeObservedCategories(SEED_EXPENSE_CATEGORIES, [{ category: '반려동물', subcategory: '사료' }])
    expect(merged['반려동물']).toEqual(['사료'])
  })

  it('does not duplicate an existing subcategory', () => {
    const merged = mergeObservedCategories(SEED_EXPENSE_CATEGORIES, [{ category: '식비', subcategory: '배달' }])
    expect(merged['식비'].filter((s) => s === '배달')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- categories`
Expected: FAIL — `Cannot find module './categories'`

- [ ] **Step 3: Implement**

```ts
export const SEED_INCOME_CATEGORIES = ['급여', '상여금', '금융수입', '기타수입', '용돈', '중고거래', '미분류']

export const SEED_TRANSFER_CATEGORIES = ['내계좌이체', '카드대금', '투자', '현금', '이체', '미분류']

export const SEED_EXPENSE_CATEGORIES: Record<string, string[]> = {
  식비: ['한식', '일식', '중식', '양식', '아시아음식', '고기', '치킨', '패스트푸드', '배달', '식재료', '미분류'],
  '카페/간식': ['커피/음료', '베이커리', '디저트/떡', '도넛/핫도그', '아이스크림/빙수', '기타간식', '미분류'],
  생활: ['편의점', '마트', '생필품', '가구/가전', '생활서비스', '미분류'],
  '주거/통신': ['월세', '관리비', '가스비', '인터넷', '휴대폰'],
  교통: ['대중교통', '택시', '철도', '시외버스'],
  자동차: ['주유', '주차', '통행료', '정비/수리'],
  온라인쇼핑: ['인터넷쇼핑', '결제/충전', '서비스구독', '앱스토어', '미분류'],
  '패션/쇼핑': ['패션', '백화점', '아울렛/몰'],
  '뷰티/미용': ['화장품', '미용용품', '헤어샵', '피부과'],
  '의료/건강': ['약국', '내과/가정의학', '이비인후과', '종합병원', '건강용품', '보조식품', '운동'],
  '문화/여가': ['영화', '도서', '게임', '음악', '취미/체험', '테마파크'],
  '술/유흥': ['맥주/호프', '이자카야', '바(BAR)', '와인'],
  '교육/학습': ['학원/강의', '미분류'],
  '경조/선물': ['축의금', '부의금', '선물', '미분류'],
  '여행/숙박': ['숙박비'],
  금융: ['은행', '카드', '증권/투자', '세금/과태료'],
  기타: ['미분류'],
}

export const SEED_PAYMENT_METHODS = [
  '삼성카드 taptap O',
  'iMND Light 신한카드',
  '일상의 기쁨(신용) 웰트리 복지비카드',
  '플리(체크)',
  '네이버페이 간편결제',
  '네이버페이 간편결제(머니)',
  '네이버페이 간편결제(포인트)',
  '네이버페이 머니',
  '카카오페이 간편결제',
  '카카오페이 머니',
  '토스 간편결제',
  '삼성월렛머니 우리 통장',
  'NH주거래우대통장',
  'KB나라사랑우대통장',
  'MY 입출금통장',
  '토스뱅크 통장',
  'OK파킹플렉스통장',
  'NH청년도약계좌',
  '주택청약종합저축',
  '월세 보증금',
  'Deep Oil',
]

export function mergeObservedPaymentMethods(observed: string[]): string[] {
  const merged = new Set([...SEED_PAYMENT_METHODS, ...observed])
  return [...merged].sort()
}

export function mergeObservedCategories(
  seed: Record<string, string[]>,
  observed: Array<{ category: string; subcategory: string }>
): Record<string, string[]> {
  const merged: Record<string, string[]> = {}
  for (const [category, subcategories] of Object.entries(seed)) {
    merged[category] = [...subcategories]
  }
  for (const { category, subcategory } of observed) {
    if (!merged[category]) {
      merged[category] = []
    }
    if (!merged[category].includes(subcategory)) {
      merged[category].push(subcategory)
    }
  }
  return merged
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- categories`
Expected: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/categories.ts src/lib/categories.test.ts
git commit -m "feat: category/payment method seed lists with auto-extend merge helpers"
```

---

### Task 8: Internal-transfer pair matching

**Files:**
- Create: `src/lib/transferMatching.ts`
- Test: `src/lib/transferMatching.test.ts`

**Interfaces:**
- Consumes: nothing (pure, operates on a minimal candidate shape).
- Produces: `TransferCandidate`, `TransferMatchResult`, `dateTimeToMinutes(date, time): number`, `matchTransferPairs(candidates): TransferMatchResult` — consumed by the Zustand store (Task 12) after every import.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { dateTimeToMinutes, matchTransferPairs, type TransferCandidate } from './transferMatching'

function candidate(id: string, date: string, time: string, amount: number, paymentMethod: string): TransferCandidate {
  return { id, amount, paymentMethod, dateTimeMinutes: dateTimeToMinutes(date, time) }
}

describe('matchTransferPairs', () => {
  it('pairs a normal opposite-sign, different-account, within-3-minutes transfer', () => {
    const a = candidate('a', '2026-07-18', '23:34:00', -120000, 'NH주거래우대통장')
    const b = candidate('b', '2026-07-18', '23:34:36', 120000, '네이버페이 머니')
    const result = matchTransferPairs([a, b])
    expect(result.pairs).toEqual([{ a: 'a', b: 'b' }])
    expect(result.unmatchedIds).toEqual([])
  })

  it('does not pair when more than 3 minutes apart', () => {
    const a = candidate('a', '2026-07-18', '23:30:00', -120000, 'NH주거래우대통장')
    const b = candidate('b', '2026-07-18', '23:34:01', 120000, '네이버페이 머니')
    const result = matchTransferPairs([a, b])
    expect(result.pairs).toEqual([])
    expect(result.unmatchedIds.sort()).toEqual(['a', 'b'])
  })

  it('does not pair when the payment method is the same account', () => {
    const a = candidate('a', '2026-07-18', '23:34:00', -120000, 'NH주거래우대통장')
    const b = candidate('b', '2026-07-18', '23:34:10', 120000, 'NH주거래우대통장')
    const result = matchTransferPairs([a, b])
    expect(result.pairs).toEqual([])
    expect(result.unmatchedIds.sort()).toEqual(['a', 'b'])
  })

  it('greedily matches the closest candidate when multiple share the same amount', () => {
    const out = candidate('out', '2026-07-18', '12:00:00', -50000, 'NH주거래우대통장')
    const near = candidate('near', '2026-07-18', '12:01:00', 50000, '네이버페이 머니')
    const far = candidate('far', '2026-07-18', '12:02:30', 50000, '카카오페이 머니')
    const result = matchTransferPairs([out, near, far])
    expect(result.pairs).toEqual([{ a: 'out', b: 'near' }])
    expect(result.unmatchedIds).toEqual(['far'])
  })

  it('leaves a transfer with no counterpart as unmatched', () => {
    const a = candidate('a', '2026-07-18', '23:34:00', -120000, 'NH주거래우대통장')
    const result = matchTransferPairs([a])
    expect(result.pairs).toEqual([])
    expect(result.unmatchedIds).toEqual(['a'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- transferMatching`
Expected: FAIL — `Cannot find module './transferMatching'`

- [ ] **Step 3: Implement**

```ts
export interface TransferCandidate {
  id: string
  amount: number
  paymentMethod: string
  dateTimeMinutes: number
}

export interface TransferMatchResult {
  pairs: Array<{ a: string; b: string }>
  unmatchedIds: string[]
}

export function dateTimeToMinutes(date: string, time: string): number {
  return Date.parse(`${date}T${time}.000Z`) / 60000
}

export function matchTransferPairs(candidates: TransferCandidate[]): TransferMatchResult {
  const used = new Set<string>()
  const pairs: Array<{ a: string; b: string }> = []

  for (const a of candidates) {
    if (used.has(a.id)) continue

    let best: TransferCandidate | null = null
    let bestDiff = Infinity

    for (const b of candidates) {
      if (a.id === b.id || used.has(b.id)) continue
      if (b.amount !== -a.amount) continue
      if (b.paymentMethod === a.paymentMethod) continue
      const diff = Math.abs(a.dateTimeMinutes - b.dateTimeMinutes)
      if (diff > 3) continue
      if (diff < bestDiff) {
        bestDiff = diff
        best = b
      }
    }

    if (best) {
      used.add(a.id)
      used.add(best.id)
      pairs.push({ a: a.id, b: best.id })
    }
  }

  const unmatchedIds = candidates.filter((c) => !used.has(c.id)).map((c) => c.id)
  return { pairs, unmatchedIds }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- transferMatching`
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/transferMatching.ts src/lib/transferMatching.test.ts
git commit -m "feat: greedy nearest-neighbor internal transfer pair matching"
```

---

### Task 9: Flow-type classification (saving vs. spending vs. income vs. neutral)

**Files:**
- Create: `src/lib/classification.ts`
- Test: `src/lib/classification.test.ts`

**Interfaces:**
- Consumes: `FlowType`, `ClassificationRule` from `src/types/transaction.ts`.
- Produces: `ClassificationInput`, `classifyFlowType(input, rules): FlowType` — consumed by the Zustand store (Task 12) for every transaction, before and after transfer-pair matching runs.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { classifyFlowType, type ClassificationInput } from './classification'
import type { ClassificationRule } from '../types/transaction'

function base(overrides: Partial<ClassificationInput> = {}): ClassificationInput {
  return {
    type: '지출',
    category: '식비',
    subcategory: '배달',
    content: '쿠팡이츠',
    paymentMethod: '삼성카드 taptap O',
    amount: -14000,
    isPairedTransfer: false,
    isUnmatchedTransfer: false,
    flowTypeOverride: null,
    ...overrides,
  }
}

describe('classifyFlowType', () => {
  it('classifies an ordinary expense as spending', () => {
    expect(classifyFlowType(base(), [])).toBe('spending')
  })

  it('classifies ordinary income as income', () => {
    const input = base({ type: '수입', category: '급여', paymentMethod: 'NH주거래우대통장', amount: 3000000 })
    expect(classifyFlowType(input, [])).toBe('income')
  })

  it('classifies a saving-account payment method as saving regardless of type', () => {
    const input = base({ type: '이체', category: '이체', paymentMethod: '주택청약종합저축', amount: -100000 })
    expect(classifyFlowType(input, [])).toBe('saving')
  })

  it('classifies an outgoing 이체>투자 as saving', () => {
    const input = base({ type: '이체', category: '투자', paymentMethod: 'MY 입출금통장', amount: -3000000 })
    expect(classifyFlowType(input, [])).toBe('saving')
  })

  it('classifies an incoming 이체>투자 (redemption) as income', () => {
    const input = base({ type: '이체', category: '투자', paymentMethod: 'OK파킹플렉스통장', amount: 1989192 })
    expect(classifyFlowType(input, [])).toBe('income')
  })

  it('classifies 지출>금융>증권/투자 as saving', () => {
    const input = base({ type: '지출', category: '금융', subcategory: '증권/투자', amount: -14260 })
    expect(classifyFlowType(input, [])).toBe('saving')
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
    const input = base({ flowTypeOverride: 'saving' })
    expect(classifyFlowType(input, [])).toBe('saving')
  })

  it('a content-based user rule wins over the default spending classification', () => {
    const input = base({ content: '토스증권 자동이체' })
    const rules: ClassificationRule[] = [
      { id: 'r1', matchType: 'content', matchValue: '토스증권 자동이체', flowType: 'saving' },
    ]
    expect(classifyFlowType(input, rules)).toBe('saving')
  })

  it('a payment-method-based user rule wins over the default spending classification', () => {
    const input = base({ paymentMethod: '내마음대로적금' })
    const rules: ClassificationRule[] = [
      { id: 'r1', matchType: 'payment_method', matchValue: '내마음대로적금', flowType: 'saving' },
    ]
    expect(classifyFlowType(input, rules)).toBe('saving')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- classification`
Expected: FAIL — `Cannot find module './classification'`

- [ ] **Step 3: Implement**

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
  flowTypeOverride: 'saving' | 'spending' | null
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

  if (SAVING_PAYMENT_METHODS.includes(input.paymentMethod)) {
    return 'saving'
  }

  if (input.type === '이체' && input.category === '투자') {
    return input.amount < 0 ? 'saving' : 'income'
  }

  if (input.type === '지출' && input.category === '금융' && input.subcategory === '증권/투자') {
    return 'saving'
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- classification`
Expected: `13 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/classification.ts src/lib/classification.test.ts
git commit -m "feat: flow-type classification rules (saving/spending/income/neutral)"
```

---

### Task 10: Aggregations (monthly summary, available months)

**Files:**
- Create: `src/lib/aggregations.ts`
- Test: `src/lib/aggregations.test.ts`

**Interfaces:**
- Consumes: `Transaction` from `src/types/transaction.ts`.
- Produces: `resolvedFlowType(tx): FlowType`, `MonthlySummary`, `summarizeByMonth(transactions): MonthlySummary[]`, `listAvailableMonths(transactions): string[]` — consumed by the Dashboard (Phase 2) and the Entries page's month filter (Phase 4).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { listAvailableMonths, resolvedFlowType, summarizeByMonth } from './aggregations'
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

describe('resolvedFlowType', () => {
  it('uses the override when present', () => {
    expect(resolvedFlowType(tx({ flowType: 'spending', flowTypeOverride: 'saving' }))).toBe('saving')
  })

  it('falls back to the computed flowType when no override', () => {
    expect(resolvedFlowType(tx({ flowType: 'spending', flowTypeOverride: null }))).toBe('spending')
  })
})

describe('summarizeByMonth', () => {
  it('sums income, spending, and saving separately per month', () => {
    const txs = [
      tx({ date: '2026-07-05', amount: 3000000, flowType: 'income' }),
      tx({ date: '2026-07-10', amount: -50000, flowType: 'spending' }),
      tx({ date: '2026-07-15', amount: -200000, flowType: 'saving' }),
    ]
    const [july] = summarizeByMonth(txs)
    expect(july).toEqual({ month: '2026-07', income: 3000000, spending: 50000, saving: 200000, netCashFlow: 2750000 })
  })

  it('nets refund rows against spending in the same category (positive-amount spending row)', () => {
    const txs = [
      tx({ date: '2026-07-10', amount: -20000, flowType: 'spending' }),
      tx({ date: '2026-07-11', amount: 2000, flowType: 'spending' }), // partial refund
    ]
    const [july] = summarizeByMonth(txs)
    expect(july.spending).toBe(18000)
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
    const txs = [tx({ date: '2026-07-10', amount: -50000, flowType: 'spending', flowTypeOverride: 'saving' })]
    const [july] = summarizeByMonth(txs)
    expect(july.spending).toBe(0)
    expect(july.saving).toBe(50000)
  })
})

describe('listAvailableMonths', () => {
  it('returns the distinct sorted list of months present in the data', () => {
    const txs = [tx({ date: '2025-07-19' }), tx({ date: '2026-07-19' }), tx({ date: '2025-08-01' })]
    expect(listAvailableMonths(txs)).toEqual(['2025-07', '2025-08', '2026-07'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- aggregations`
Expected: FAIL — `Cannot find module './aggregations'`

- [ ] **Step 3: Implement**

```ts
import type { FlowType, Transaction } from '../types/transaction'

export function resolvedFlowType(tx: Pick<Transaction, 'flowType' | 'flowTypeOverride'>): FlowType {
  return tx.flowTypeOverride ?? tx.flowType
}

export interface MonthlySummary {
  month: string
  income: number
  spending: number
  saving: number
  netCashFlow: number
}

export function summarizeByMonth(transactions: Transaction[]): MonthlySummary[] {
  const buckets = new Map<string, { income: number; spending: number; saving: number }>()

  for (const t of transactions) {
    const flow = resolvedFlowType(t)
    if (flow === 'neutral') continue

    const month = t.date.slice(0, 7)
    if (!buckets.has(month)) {
      buckets.set(month, { income: 0, spending: 0, saving: 0 })
    }
    const bucket = buckets.get(month)!
    if (flow === 'income') bucket.income += t.amount
    else if (flow === 'spending') bucket.spending += t.amount
    else if (flow === 'saving') bucket.saving += t.amount
  }

  return [...buckets.entries()]
    .map(([month, bucket]) => {
      const income = bucket.income
      const spending = Math.abs(bucket.spending)
      const saving = Math.abs(bucket.saving)
      return { month, income, spending, saving, netCashFlow: income - spending - saving }
    })
    .sort((a, b) => a.month.localeCompare(b.month))
}

export function listAvailableMonths(transactions: Transaction[]): string[] {
  const months = new Set(transactions.map((t) => t.date.slice(0, 7)))
  return [...months].sort()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- aggregations`
Expected: `8 passed`

- [ ] **Step 5: Run the full test suite**

Run: `npm run test`
Expected: all suites pass (idHash, format, excelParser, categories, transferMatching, classification, aggregations).

- [ ] **Step 6: Commit**

```bash
git add src/lib/aggregations.ts src/lib/aggregations.test.ts
git commit -m "feat: monthly aggregation and available-months helpers"
```

---

### Task 11: Supabase schema, RLS, and client

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Create: `src/lib/supabase.ts`

**Interfaces:**
- Produces: `supabase` client instance — consumed by the Zustand store (Task 12) and auth pages (Task 13).

- [ ] **Step 1: Create the migration file**

```sql
create table transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) default auth.uid(),
  date date not null,
  time time not null,
  type text not null check (type in ('수입','지출','이체')),
  category text not null,
  subcategory text not null,
  content text not null,
  amount integer not null,
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

- [ ] **Step 2: Apply the migration manually (one-time, human step)**

This step cannot be automated from this repo (requires a real Supabase project and dashboard access):

1. Go to https://supabase.com/dashboard, create a project (or use an existing one) named e.g. `budget-book`.
2. Open **SQL Editor**, paste the contents of `supabase/migrations/0001_init.sql`, and run it.
3. Open **Authentication → Providers**, enable **Google**, and fill in a Google OAuth Client ID/Secret (create one at https://console.cloud.google.com/apis/credentials if needed, with an authorized redirect URI matching the value Supabase shows on that page).
4. Open **Authentication → URL Configuration** and add `http://localhost:5173` to the Site URL / Redirect URLs list for local dev (add the Vercel production URL later in Phase 5).
5. Open **Project Settings → API**, copy the **Project URL** and **anon public key**.

Expected: after running the SQL, the Table Editor shows `transactions` and `classification_rules` with RLS enabled (a lock icon).

- [ ] **Step 3: Create `.env.local` with the real values (not committed)**

```
VITE_SUPABASE_URL=<paste Project URL here>
VITE_SUPABASE_ANON_KEY=<paste anon public key here>
```

Expected: `.env.local` exists locally; `git status` does not show it as untracked-to-commit (it's covered by `.gitignore`).

- [ ] **Step 4: Create `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다. .env.local을 확인하세요.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 5: Verify the app still builds with the client present**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0001_init.sql src/lib/supabase.ts
git commit -m "feat: supabase schema, RLS policies, and client init"
```

(Note: `.env.local` is intentionally not added — it's gitignored.)

---

### Task 12: Zustand transaction store (Supabase-backed)

**Files:**
- Create: `src/store/useTransactionStore.ts`

**Interfaces:**
- Consumes: `supabase` (Task 11), `Transaction`, `ClassificationRule` (Task 3), `computeTransactionId` (Task 4), `ParsedRawRow` (Task 6), `classifyFlowType` (Task 9), `matchTransferPairs`, `dateTimeToMinutes` (Task 8).
- Produces: `useTransactionStore` hook with state `{ transactions: Transaction[], rules: ClassificationRule[], loading: boolean }` and actions `fetchAll(): Promise<void>`, `importRows(rows: ParsedRawRow[]): Promise<{ inserted: number; duplicates: number }>`, `updateTransaction(id: string, patch: Partial<Transaction>): Promise<void>`, `deleteTransaction(id: string): Promise<void>`, `setOverride(id: string, override: 'saving' | 'spending' | null): Promise<void>`, `addRule(rule: Omit<ClassificationRule, 'id'>): Promise<void>` — consumed by the Import page (Task 14) and every future page.

- [ ] **Step 1: Create the store**

```ts
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { computeTransactionId } from '../lib/idHash'
import { classifyFlowType } from '../lib/classification'
import { matchTransferPairs, dateTimeToMinutes, type TransferCandidate } from '../lib/transferMatching'
import type { ParsedRawRow } from '../lib/excelParser'
import type { ClassificationRule, Transaction } from '../types/transaction'

interface TransactionRow {
  id: string
  date: string
  time: string
  type: Transaction['type']
  category: string
  subcategory: string
  content: string
  amount: number
  currency: string
  payment_method: string
  memo: string | null
  flow_type: Transaction['flowType']
  flow_type_override: Transaction['flowTypeOverride']
  transfer_pair_id: string | null
  is_paired_transfer: boolean
  is_unmatched_transfer: boolean
}

function rowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    type: row.type,
    category: row.category,
    subcategory: row.subcategory,
    content: row.content,
    amount: row.amount,
    currency: row.currency,
    paymentMethod: row.payment_method,
    memo: row.memo,
    flowType: row.flow_type,
    flowTypeOverride: row.flow_type_override,
    transferPairId: row.transfer_pair_id,
    isPairedTransfer: row.is_paired_transfer,
    isUnmatchedTransfer: row.is_unmatched_transfer,
  }
}

function transactionToRow(t: Transaction): TransactionRow {
  return {
    id: t.id,
    date: t.date,
    time: t.time,
    type: t.type,
    category: t.category,
    subcategory: t.subcategory,
    content: t.content,
    amount: t.amount,
    currency: t.currency,
    payment_method: t.paymentMethod,
    memo: t.memo,
    flow_type: t.flowType,
    flow_type_override: t.flowTypeOverride,
    transfer_pair_id: t.transferPairId,
    is_paired_transfer: t.isPairedTransfer,
    is_unmatched_transfer: t.isUnmatchedTransfer,
  }
}

async function recomputeTransferPairing(transactions: Transaction[]): Promise<Map<string, Partial<Transaction>>> {
  const internal = transactions.filter((t) => t.type === '이체' && t.category === '내계좌이체')
  const candidates: TransferCandidate[] = internal.map((t) => ({
    id: t.id,
    amount: t.amount,
    paymentMethod: t.paymentMethod,
    dateTimeMinutes: dateTimeToMinutes(t.date, t.time),
  }))
  const { pairs, unmatchedIds } = matchTransferPairs(candidates)

  const patches = new Map<string, Partial<Transaction>>()
  for (const { a, b } of pairs) {
    patches.set(a, { transferPairId: `${a}:${b}`, isPairedTransfer: true, isUnmatchedTransfer: false })
    patches.set(b, { transferPairId: `${a}:${b}`, isPairedTransfer: true, isUnmatchedTransfer: false })
  }
  for (const id of unmatchedIds) {
    patches.set(id, { transferPairId: null, isPairedTransfer: false, isUnmatchedTransfer: true })
  }
  return patches
}

interface TransactionStoreState {
  transactions: Transaction[]
  rules: ClassificationRule[]
  loading: boolean
  fetchAll: () => Promise<void>
  importRows: (rows: ParsedRawRow[]) => Promise<{ inserted: number; duplicates: number }>
  updateTransaction: (id: string, patch: Partial<Transaction>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  setOverride: (id: string, override: 'saving' | 'spending' | null) => Promise<void>
  addRule: (rule: Omit<ClassificationRule, 'id'>) => Promise<void>
}

export const useTransactionStore = create<TransactionStoreState>((set, get) => ({
  transactions: [],
  rules: [],
  loading: false,

  async fetchAll() {
    set({ loading: true })
    const [{ data: txRows, error: txError }, { data: ruleRows, error: ruleError }] = await Promise.all([
      supabase.from('transactions').select('*'),
      supabase.from('classification_rules').select('*'),
    ])
    if (txError) throw txError
    if (ruleError) throw ruleError

    const rules: ClassificationRule[] = (ruleRows ?? []).map((r) => ({
      id: r.id,
      matchType: r.match_type,
      matchValue: r.match_value,
      flowType: r.flow_type,
    }))

    const transactions = (txRows ?? []).map(rowToTransaction)
    set({ transactions, rules, loading: false })
  },

  async importRows(rows) {
    const existingIds = new Set(get().transactions.map((t) => t.id))
    const rules = get().rules

    const withIds = await Promise.all(
      rows.map(async (row) => ({
        row,
        id: await computeTransactionId({
          date: row.date,
          time: row.time,
          type: row.type,
          category: row.category,
          subcategory: row.subcategory,
          content: row.content,
          amount: row.amount,
          paymentMethod: row.paymentMethod,
        }),
      }))
    )

    const newOnes = withIds.filter(({ id }) => !existingIds.has(id))
    const duplicates = withIds.length - newOnes.length

    const newTransactions: Transaction[] = newOnes.map(({ row, id }) => ({
      id,
      date: row.date,
      time: row.time,
      type: row.type,
      category: row.category,
      subcategory: row.subcategory,
      content: row.content,
      amount: row.amount,
      currency: row.currency,
      paymentMethod: row.paymentMethod,
      memo: row.memo,
      flowType: 'spending',
      flowTypeOverride: null,
      transferPairId: null,
      isPairedTransfer: false,
      isUnmatchedTransfer: false,
    }))

    const allTransactions = [...get().transactions, ...newTransactions]
    const pairingPatches = await recomputeTransferPairing(allTransactions)

    const finalized = allTransactions.map((t) => {
      const patch = pairingPatches.get(t.id) ?? {
        transferPairId: null,
        isPairedTransfer: false,
        isUnmatchedTransfer: false,
      }
      const merged = { ...t, ...patch }
      // `flowType` stores the AUTOMATIC classification only — pass flowTypeOverride: null here
      // even though the transaction may have one, so a later override removal still falls back
      // to a correct computed value (see aggregations.ts#resolvedFlowType, which applies the
      // override at read time). Only the `flowTypeOverride` column itself carries the override.
      merged.flowType = classifyFlowType(
        {
          type: merged.type,
          category: merged.category,
          subcategory: merged.subcategory,
          content: merged.content,
          paymentMethod: merged.paymentMethod,
          amount: merged.amount,
          isPairedTransfer: merged.isPairedTransfer,
          isUnmatchedTransfer: merged.isUnmatchedTransfer,
          flowTypeOverride: null,
        },
        rules
      )
      return merged
    })

    if (finalized.length > 0) {
      const { error } = await supabase.from('transactions').upsert(finalized.map(transactionToRow))
      if (error) throw error
    }

    set({ transactions: finalized })
    return { inserted: newOnes.length, duplicates }
  },

  async updateTransaction(id, patch) {
    const current = get().transactions.find((t) => t.id === id)
    if (!current) return
    const updated = { ...current, ...patch }
    const { error } = await supabase.from('transactions').update(transactionToRow(updated)).eq('id', id)
    if (error) throw error
    set({ transactions: get().transactions.map((t) => (t.id === id ? updated : t)) })
  },

  async deleteTransaction(id) {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) throw error
    set({ transactions: get().transactions.filter((t) => t.id !== id) })
  },

  async setOverride(id, override) {
    await get().updateTransaction(id, { flowTypeOverride: override })
  },

  async addRule(rule) {
    const { data, error } = await supabase
      .from('classification_rules')
      .insert({ match_type: rule.matchType, match_value: rule.matchValue, flow_type: rule.flowType })
      .select()
      .single()
    if (error) throw error
    set({
      rules: [...get().rules, { id: data.id, matchType: data.match_type, matchValue: data.match_value, flowType: data.flow_type }],
    })
  },
}))
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/useTransactionStore.ts
git commit -m "feat: zustand transaction store wired to supabase with import/pairing/classification pipeline"
```

---

### Task 13: Google login and auth guard

**Files:**
- Create: `src/auth/LoginPage.tsx`
- Create: `src/auth/AuthGuard.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 11).
- Produces: `LoginPage` component, `AuthGuard` component (wraps children, redirects to sign-in UI when no session) — consumed by `App.tsx` and every future page.

- [ ] **Step 1: Create `src/auth/LoginPage.tsx`**

```tsx
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <h1 className="mb-6 text-2xl font-bold text-slate-800">가계부</h1>
        <button
          onClick={signInWithGoogle}
          className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
        >
          Google로 로그인
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/auth/AuthGuard.tsx`**

```tsx
import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import LoginPage from './LoginPage'

export default function AuthGuard({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return <div className="p-8 text-slate-500">불러오는 중...</div>
  }

  if (session === null) {
    return <LoginPage />
  }

  return <>{children}</>
}
```

- [ ] **Step 3: Wire `AuthGuard` into `src/App.tsx`**

```tsx
import AuthGuard from './auth/AuthGuard'

export default function App() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50 p-8">
        <h1 className="text-2xl font-bold text-slate-800">가계부</h1>
      </div>
    </AuthGuard>
  )
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open the printed localhost URL in a browser.
Expected: the login screen renders with a "Google로 로그인" button. Clicking it redirects to Google's OAuth consent screen (requires Task 11 Step 2's Google provider setup to be complete — if it errors, double check the Supabase Auth provider configuration, not the app code).

- [ ] **Step 6: Commit**

```bash
git add src/auth/LoginPage.tsx src/auth/AuthGuard.tsx src/App.tsx
git commit -m "feat: google login and auth guard"
```

---

### Task 14: Import page (drag-and-drop, month selection, dedup summary)

**Files:**
- Create: `src/pages/ImportPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `parseWorkbook`, `findTargetSheet` (Task 6), `useTransactionStore` (Task 12), `listAvailableMonths` (Task 10), `formatKRW` (Task 5).
- Produces: `ImportPage` component — the first real screen a user interacts with to get data in. Wired into `App.tsx` as the default view for this phase (Dashboard/Month/Entries pages arrive in later phases).

- [ ] **Step 1: Create `src/pages/ImportPage.tsx`**

```tsx
import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { parseWorkbook, type ParsedRawRow } from '../lib/excelParser'
import { useTransactionStore } from '../store/useTransactionStore'
import { formatKRW } from '../lib/format'

export default function ImportPage() {
  const [parsedRows, setParsedRows] = useState<ParsedRawRow[]>([])
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set())
  const [summary, setSummary] = useState<{ inserted: number; duplicates: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const importRows = useTransactionStore((s) => s.importRows)

  const months = useMemo(() => {
    const set = new Set(parsedRows.map((r) => r.date.slice(0, 7)))
    return [...set].sort()
  }, [parsedRows])

  async function handleFile(file: File) {
    setError(null)
    setSummary(null)
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const rows = parseWorkbook(workbook)
      setParsedRows(rows)
      setSelectedMonths(new Set(rows.map((r) => r.date.slice(0, 7))))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function toggleMonth(month: string) {
    setSelectedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(month)) next.delete(month)
      else next.add(month)
      return next
    })
  }

  async function handleImport() {
    const rowsToImport = parsedRows.filter((r) => selectedMonths.has(r.date.slice(0, 7)))
    const result = await importRows(rowsToImport)
    setSummary(result)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">데이터 불러오기</h1>

      <input
        type="file"
        accept=".xlsx"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
        className="mb-6 block"
      />

      {error && <p className="mb-4 text-rose-600">{error}</p>}

      {parsedRows.length > 0 && (
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <p className="mb-3 font-medium text-slate-700">불러올 월 선택 ({parsedRows.length}건 파싱됨)</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {months.map((month) => (
              <label key={month} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={selectedMonths.has(month)}
                  onChange={() => toggleMonth(month)}
                />
                {month}
              </label>
            ))}
          </div>
          <button
            onClick={handleImport}
            className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700"
          >
            선택한 월 불러오기
          </button>
        </div>
      )}

      {summary && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-slate-700">
            신규 {summary.inserted}건, 중복(스킵) {summary.duplicates}건
          </p>
        </div>
      )}

      {parsedRows.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl bg-white p-6 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-2 pr-4">날짜</th>
                <th className="pb-2 pr-4">타입</th>
                <th className="pb-2 pr-4">대분류</th>
                <th className="pb-2 pr-4">내용</th>
                <th className="pb-2 pr-4">금액</th>
                <th className="pb-2">결제수단</th>
              </tr>
            </thead>
            <tbody>
              {parsedRows.slice(0, 50).map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1.5 pr-4">{row.date}</td>
                  <td className="py-1.5 pr-4">{row.type}</td>
                  <td className="py-1.5 pr-4">{row.category}</td>
                  <td className="py-1.5 pr-4">{row.content}</td>
                  <td className={`py-1.5 pr-4 ${row.amount < 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                    {formatKRW(row.amount)}
                  </td>
                  <td className="py-1.5">{row.paymentMethod}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {parsedRows.length > 50 && (
            <p className="mt-2 text-xs text-slate-400">처음 50건만 미리보기로 표시됩니다.</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire `ImportPage` into `src/App.tsx`**

```tsx
import { useEffect } from 'react'
import AuthGuard from './auth/AuthGuard'
import ImportPage from './pages/ImportPage'
import { useTransactionStore } from './store/useTransactionStore'

export default function App() {
  const fetchAll = useTransactionStore((s) => s.fetchAll)

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return (
    <AuthGuard>
      <ImportPage />
    </AuthGuard>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual end-to-end verification**

Run: `npm run dev`, sign in with Google, go to the Import page, drag in `data/2025-07-19~2026-07-19.xlsx`.
Expected:
- Preview table shows real transactions with correctly formatted dates and 원 amounts.
- Month checkboxes list all months present in the file (2025-07 through 2026-07).
- Clicking "선택한 월 불러오기" shows a summary (`신규 N건, 중복(스킵) M건`).
- Re-importing the same file again shows `신규 0건, 중복(스킵) 1668건` (idempotent import, proving the deterministic ID + dedup logic works against the real file).
- Open the Supabase Table Editor and confirm the `transactions` table has ~1668 rows, with some rows showing `is_paired_transfer = true` and a few `is_unmatched_transfer = true`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ImportPage.tsx src/App.tsx
git commit -m "feat: import page with month selection and dedup summary"
```

---

### Task 15: README

**Files:**
- Create: `README.md`

**Interfaces:**
- Produces: setup instructions for a fresh clone.

- [ ] **Step 1: Write `README.md`**

```md
# 가계부 (Budget Book)

개인용 가계부 웹앱. 뱅크샐러드 엑셀 내보내기를 불러와 수입/지출/저축을 구분해 보여준다.

## 설정

1. `npm install`
2. Supabase 프로젝트를 만들고 `supabase/migrations/0001_init.sql`을 SQL Editor에서 실행한다.
3. Supabase Authentication → Providers에서 Google 로그인을 활성화한다.
4. `.env.example`을 `.env.local`로 복사하고 Supabase 프로젝트의 URL/anon key를 채운다.
5. `npm run dev`로 실행한다.

## 데이터 불러오기

`/import` 화면에서 뱅크샐러드 내보내기 엑셀(`가계부 내역` 시트)을 드래그&드롭하면 파싱 미리보기가 뜬다. 불러올 월을 체크하고 "선택한 월 불러오기"를 누르면 저장된다. 이미 저장된 거래는 자동으로 중복 스킵된다.

## 테스트

`npm run test`

## 설계 문서

- `docs/superpowers/specs/2026-07-19-budget-book-design.md`
- `docs/superpowers/plans/2026-07-19-budget-book-foundation.md` (이 단계)
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add setup README"
```

- [ ] **Step 3: Push everything to GitHub**

```bash
git push origin master
```

Expected: all commits from this plan appear on `https://github.com/artistfeels/budget-book`.

---

## What's next (not in this plan)

Phase 2 (Dashboard), Phase 3 (Month detail with calendar/spending pace), Phase 4 (full Entries CRUD with inline editing and rule management), and Phase 5 (Vercel deploy + polish) each get their own plan, written after this foundation is merged and manually verified — per the design doc's section 4 ordering.
