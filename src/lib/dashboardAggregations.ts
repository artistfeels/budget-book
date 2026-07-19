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
