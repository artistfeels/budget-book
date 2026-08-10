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
  income: number
  isPartial: boolean
}

export function weeklySpendingBands(transactions: Transaction[], month: string): WeeklyBand[] {
  const daily = dailySummaries(transactions, month)
  const bands: WeeklyBand[] = []
  let current: string[] = []
  let currentTotal = 0
  let currentIncome = 0
  let weekIndex = 0

  function flush() {
    if (current.length === 0) return
    bands.push({
      weekIndex,
      startDate: current[0],
      endDate: current[current.length - 1],
      total: currentTotal,
      income: currentIncome,
      isPartial: current.length < 7,
    })
    weekIndex++
    current = []
    currentTotal = 0
    currentIncome = 0
  }

  for (const day of daily) {
    const dayOfWeek = new Date(`${day.date}T00:00:00`).getDay() // 0=Sun..6=Sat
    const isMonday = dayOfWeek === 1
    if (isMonday && current.length > 0) flush()
    current.push(day.date)
    currentTotal += day.spending
    currentIncome += day.income
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
  // Callers (e.g. SpendingPaceChart for past months) may pass a sentinel like 31 that
  // exceeds the viewed month's actual day count. Clamp once here so every downstream
  // calculation (daily rate, projection, same-day comparison) uses a valid day index.
  const clampedAsOfDay = Math.min(asOfDay, daysInMonth)

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

    // Once a baseline month's own days run out (e.g. Feb ends at day 28 while the viewed month
    // has 31), keep contributing its held cumulative total to the average instead of dropping it
    // — a shorter baseline month should flatten the average line past its end, not yank it down
    // by silently reducing avgCount.
    let avgSum = 0
    let avgCount = 0
    avgMonthsDaily.forEach((d, i) => {
      if (day <= d.length) {
        avgCums[i] += d[day - 1].spending
      }
      avgSum += avgCums[i]
      avgCount++
    })

    points.push({
      day,
      thisMonth: day <= clampedAsOfDay && day <= daysInMonth ? thisCum : null,
      thisMonthProjected: null,
      lastMonth: day <= prevDaily.length ? lastCum : null,
      threeMonthAvg: avgCount > 0 ? avgSum / avgCount : null,
    })
  }

  // The accumulation loop above runs up to maxDay so lastMonth/threeMonthAvg cumulative
  // sums stay correct even when a comparison month is longer than the viewed month, but
  // the returned series should only cover the viewed month's actual days.
  points.length = daysInMonth

  const atAsOf = points[clampedAsOfDay - 1]?.thisMonth ?? 0
  const dailyRate = clampedAsOfDay > 0 ? atAsOf / clampedAsOfDay : 0

  // Pattern-aware projection: instead of assuming a flat daily rate for the rest of the month,
  // scale the trailing-3-month average's remaining-days *shape* by how this month is tracking
  // relative to that average so far. This lets a known within-month pattern (e.g. rent landing on
  // the 23rd) show up in the projection before that day arrives, not just after. Falls back to the
  // flat rate when there's no usable historical baseline yet (avgAtAsOf is 0 — e.g. brand new data).
  // The scale factor is clamped so a handful of early-month transactions can't extrapolate into an
  // absurd month-end total (e.g. one unusually large early purchase implying 10x normal pace).
  const avgAtAsOf = clampedAsOfDay > 0 ? points[clampedAsOfDay - 1]?.threeMonthAvg ?? 0 : 0
  const rawScale = avgAtAsOf > 0 ? atAsOf / avgAtAsOf : null
  const scale = rawScale !== null ? Math.min(3, Math.max(0.3, rawScale)) : null

  for (let day = clampedAsOfDay; day <= daysInMonth; day++) {
    points[day - 1].thisMonthProjected =
      scale !== null
        ? atAsOf + ((points[day - 1].threeMonthAvg ?? avgAtAsOf) - avgAtAsOf) * scale
        : dailyRate * day
  }
  const projectedMonthEndTotal =
    scale !== null
      ? atAsOf + ((points[daysInMonth - 1]?.threeMonthAvg ?? avgAtAsOf) - avgAtAsOf) * scale
      : dailyRate * daysInMonth

  // "Same day" comparison: if the previous month has fewer days than asOfDay (e.g. viewing
  // July fully against a 30-day June), fall back to the previous month's last available day
  // instead of bailing out to null — the previous month's data still exists, just not at that exact index.
  const lastMonthSameDayIndex = Math.min(clampedAsOfDay, prevDaily.length)
  const lastMonthAtAsOf = lastMonthSameDayIndex > 0 ? points[lastMonthSameDayIndex - 1]?.lastMonth ?? null : null
  const percentVsLastMonthSameDay =
    lastMonthAtAsOf !== null && lastMonthAtAsOf !== 0 ? (atAsOf - lastMonthAtAsOf) / lastMonthAtAsOf : null

  return { points, asOfDay: clampedAsOfDay, projectedMonthEndTotal, percentVsLastMonthSameDay }
}

export interface PendingCost {
  amount: number
  typicalDay: number
}

// Recurring fixed costs (rent, subscriptions) don't scale with how much variable spending
// (coffee, groceries) has happened this month, but the pace-scaled statistical projection would
// otherwise treat them that way — a slow start on incidentals shrinks the `scale` factor, which
// shrinks the historical rent spike baked into the 3-month-average shape right along with it, so
// a 900k rent charge can show up as a 400-500k projected bump instead. Keeping the two fully
// separate fixes this: `nonSubscriptionPoints` must come from spendingPaceSeries run over
// transactions with subscription merchants filtered OUT, so its `thisMonthProjected` is a pace
// projection of ONLY variable spending. Each subscription's own known amount is then layered on
// top as a flat, unscaled step — a merchant that already posted this month contributes a constant
// offset (postedSubscriptionTotal) from day one; a merchant still pending contributes its full
// amount as a step exactly on its typical due day, not scaled by pace and not smoothed.
export function blendSubscriptionProjection(
  fullPoints: SpendingPacePoint[],
  nonSubscriptionPoints: SpendingPacePoint[],
  asOfDay: number,
  daysInMonth: number,
  postedSubscriptionTotal: number,
  pendingCosts: PendingCost[]
): { points: SpendingPacePoint[]; projectedMonthEndTotal: number } {
  // A due date that's already passed without posting is overdue, not still "on" its old date —
  // pull it forward to the next forecastable day so its full amount still lands somewhere.
  const dueDays = pendingCosts
    .map((c) => ({ amount: c.amount, day: Math.min(Math.max(c.typicalDay, asOfDay + 1), daysInMonth) }))
    .sort((a, b) => a.day - b.day)

  const points = fullPoints.map((p, i) => {
    const nonSubProjected = nonSubscriptionPoints[i]?.thisMonthProjected
    if (nonSubProjected === null || nonSubProjected === undefined) return p
    const dueSoFar = dueDays.filter((d) => d.day <= p.day).reduce((sum, d) => sum + d.amount, 0)
    return { ...p, thisMonthProjected: nonSubProjected + postedSubscriptionTotal + dueSoFar }
  })

  const pendingTotal = pendingCosts.reduce((sum, c) => sum + c.amount, 0)
  const projectedMonthEndTotal =
    (nonSubscriptionPoints[daysInMonth - 1]?.thisMonthProjected ?? 0) + postedSubscriptionTotal + pendingTotal

  return { points, projectedMonthEndTotal }
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
