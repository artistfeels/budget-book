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

export function listAvailableMonths(transactions: Transaction[]): string[] {
  const months = new Set(transactions.map((t) => t.date.slice(0, 7)))
  return [...months].sort()
}

export function monthOverMonthChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return (current - previous) / previous
}
