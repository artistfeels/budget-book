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
