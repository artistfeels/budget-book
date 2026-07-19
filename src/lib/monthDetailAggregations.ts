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
