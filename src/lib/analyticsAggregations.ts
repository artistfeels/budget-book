import type { Transaction } from '../types/transaction'
import type { MonthlySummary } from './aggregations'
import { resolvedFlowType } from './aggregations'
import { formatKRW } from './format'

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

function mean(nums: number[]): number {
  return nums.reduce((sum, n) => sum + n, 0) / nums.length
}

export function detectSubscriptions(transactions: Transaction[]): Subscription[] {
  const spendingTx = transactions.filter((t) => resolvedFlowType(t) === 'spending')
  const months = [...new Set(spendingTx.map((t) => t.date.slice(0, 7)))].sort()
  if (months.length < 2) return []
  // Grouping by merchant name alone (not merchant+exact-amount) catches usage-billed recurring
  // costs — phone/internet bills, rent with periodic adjustments — where the amount isn't
  // identical every month. A trailing 4-month window requiring presence in at least 3 tolerates
  // one skipped/delayed month.
  const windowMonths = months.slice(-4)
  const minMonths = Math.min(3, windowMonths.length)
  // "Recent" is the last 2 months, not strictly the latest one — the latest month is often still
  // in progress, and a bill that posts later in the cycle (e.g. rent on the 23rd) wouldn't have
  // posted yet in a barely-started month, which would otherwise wrongly exclude an active subscription.
  const recentMonths = new Set(windowMonths.slice(-2))

  const groups = new Map<
    string,
    { merchant: string; monthlyTotals: Map<string, number>; monthlyCounts: Map<string, number> }
  >()
  for (const t of spendingTx) {
    const txMonth = t.date.slice(0, 7)
    if (!windowMonths.includes(txMonth)) continue
    const group = groups.get(t.content) ?? {
      merchant: t.content,
      monthlyTotals: new Map<string, number>(),
      monthlyCounts: new Map<string, number>(),
    }
    const amount = Math.abs(t.amount)
    group.monthlyTotals.set(txMonth, (group.monthlyTotals.get(txMonth) ?? 0) + amount)
    group.monthlyCounts.set(txMonth, (group.monthlyCounts.get(txMonth) ?? 0) + 1)
    groups.set(t.content, group)
  }

  return [...groups.values()]
    .filter((g) => {
      if (g.monthlyTotals.size < minMonths) return false
      if (![...recentMonths].some((m) => g.monthlyTotals.has(m))) return false
      // Recurring bills/subscriptions post at most ~once a month — reject merchants visited
      // many times a month (coffee shops, convenience stores) that would otherwise pass the
      // month-count check purely from being frequent, not because they recur monthly.
      if (Math.max(...g.monthlyCounts.values()) > 2) return false
      // Usage-billed costs (phone/internet) fluctuate month to month but not wildly — reject
      // merchants whose monthly total varies too much to plausibly be the same recurring charge.
      const totals = [...g.monthlyTotals.values()]
      const avg = mean(totals)
      const coefficientOfVariation = avg > 0 ? Math.sqrt(mean(totals.map((v) => (v - avg) ** 2))) / avg : 0
      return coefficientOfVariation < 0.35
    })
    .map((g) => ({
      merchant: g.merchant,
      amount: Math.round(mean([...g.monthlyTotals.values()])),
      monthCount: g.monthlyTotals.size,
    }))
    .sort((a, b) => b.amount - a.amount)
}

// Detected recurring merchants that haven't posted a transaction yet in the given month — their
// average amount is a near-certain remaining cost, useful as a floor under a statistical spending
// projection (a subscription due on the 23rd is still coming even if the month started quietly).
// Deliberately narrower than a category-level check: grouping by category flagged almost every
// category with any 2-of-3-month history as "pending", which is most categories for a normal
// spender — merchant-level detectSubscriptions is the more conservative, accurate signal.
export function pendingSubscriptionTotal(transactions: Transaction[], month: string): number {
  const subscriptions = detectSubscriptions(transactions)
  const monthMerchants = new Set(transactions.filter((t) => t.date.slice(0, 7) === month).map((t) => t.content))
  return subscriptions.filter((s) => !monthMerchants.has(s.merchant)).reduce((sum, s) => sum + s.amount, 0)
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
    const baselineAmount = Math.round(Math.max(0, -signedSum / perMonth.size))
    const currentAmount = Math.max(0, -(currentByCategory.get(category) ?? 0))
    result.push({ category, currentAmount, baselineAmount, changeAmount: currentAmount - baselineAmount })
  }
  return result.sort((a, b) => b.changeAmount - a.changeAmount)
}

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
    insights.push({ text: `이번 달 심야(22시~24시) 지출이 ${formatKRW(lateNight.amount)}이에요` })
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

export function latestMonthWithSpending(transactions: Transaction[], availableMonths: string[]): string | undefined {
  for (let i = availableMonths.length - 1; i >= 0; i--) {
    const month = availableMonths[i]
    const hasSpending = transactions.some(
      (t) => t.date.slice(0, 7) === month && resolvedFlowType(t) === 'spending'
    )
    if (hasSpending) return month
  }
  return availableMonths[availableMonths.length - 1]
}

export function topSpendingCategories(trends: CategoryTrend[], limit: number): CategoryTrend[] {
  return trends
    .filter((t) => t.baselineAmount > 0)
    .sort((a, b) => b.baselineAmount - a.baselineAmount)
    .slice(0, limit)
}
