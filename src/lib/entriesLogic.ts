import type { Transaction } from '../types/transaction'
import { resolvedFlowType } from './aggregations'

export type EntrySection = 'income' | 'spending'

export const ENTRY_SECTIONS: EntrySection[] = ['income', 'spending']

export const ENTRY_SECTION_LABELS: Record<EntrySection, string> = {
  income: '수입',
  spending: '지출',
}

export type EntryColumnKey = 'date' | 'content' | 'category' | 'subcategory' | 'paymentMethod' | 'amount'

export function filterBySection(transactions: Transaction[], section: EntrySection): Transaction[] {
  return transactions.filter((t) => resolvedFlowType(t) === section)
}

/** Transactions the user has manually excluded as "내 계좌 간 이동인데 잘못 찍힌 거래" — not a real automatic-neutral transfer, a deliberate override. */
export function filterExcluded(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => t.flowTypeOverride === 'neutral')
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

/** `YYYY-MM` key for a Date — the month-key convention used across the app. */
export function currentMonthKey(today: Date): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
}

export function defaultDateForMonth(month: string, today: Date): string {
  const todayMonth = currentMonthKey(today)
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
  value: string | number,
  /**
   * Current signed amount of the row being edited, when one exists. `spending` rows may legitimately
   * carry a POSITIVE amount (refunds net against spending — see aggregations.ts#summarizeByMonth), so
   * editing the magnitude of an existing row must preserve whatever sign it already has. Omit it (or
   * pass 0) for a brand-new draft row, which has no prior sign and falls back to the section default.
   */
  currentAmount?: number
): Partial<Transaction> {
  if (key === 'amount') {
    const magnitude = Math.abs(Number(value))
    if (currentAmount !== undefined && currentAmount !== 0) {
      return { amount: currentAmount < 0 ? -magnitude : magnitude }
    }
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
