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
