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

  // The accumulation loop above runs up to maxDay so lastMonth/threeMonthAvg cumulative
  // sums stay correct even when a comparison month is longer than the viewed month, but
  // the returned series should only cover the viewed month's actual days.
  points.length = daysInMonth

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
