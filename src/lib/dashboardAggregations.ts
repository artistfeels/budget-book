import type { Transaction } from '../types/transaction'
import { resolvedFlowType } from './aggregations'

export interface AmountBreakdownItem {
  label: string
  amount: number
  count: number
}

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

export function topMerchants(transactions: Transaction[], limit = 10): AmountBreakdownItem[] {
  return bucketBySpending(transactions, (t) => t.content).slice(0, limit)
}

export function paymentMethodBreakdown(transactions: Transaction[]): AmountBreakdownItem[] {
  return bucketBySpending(transactions, (t) => t.paymentMethod)
}

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
