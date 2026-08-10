import { useMemo } from 'react'
import { dailySummaries, weeklySpendingBands } from '../../lib/monthDetailAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface CalendarGridProps {
  transactions: Transaction[]
  month: string
  onDayClick: (date: string) => void
}

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

export default function CalendarGrid({ transactions, month, onDayClick }: CalendarGridProps) {
  const daily = useMemo(() => dailySummaries(transactions, month), [transactions, month])
  const bands = useMemo(() => weeklySpendingBands(transactions, month), [transactions, month])

  const maxWeeklyTotal = useMemo(() => Math.max(1, ...bands.map((b) => b.total)), [bands])
  const maxSpending = useMemo(() => Math.max(1, ...daily.map((d) => d.spending)), [daily])

  const firstDayOffset = useMemo(() => {
    if (daily.length === 0) return 0
    const dow = new Date(`${daily[0].date}T00:00:00`).getDay()
    return dow === 0 ? 6 : dow - 1 // Monday-start offset
  }, [daily])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <div className="mb-3 grid grid-cols-7 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>
      {bands.map((band) => {
        const bandDays = daily.filter((d) => d.date >= band.startDate && d.date <= band.endDate)
        const weeklyBarWidth = (band.total / maxWeeklyTotal) * 100

        return (
          <div
            key={band.weekIndex}
            className="mb-3 overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800"
          >
            <div className="relative px-3 py-2">
              <div
                className="absolute inset-y-0 left-0 bg-rose-50 dark:bg-rose-950"
                style={{ width: `${band.total > 0 ? weeklyBarWidth : 0}%` }}
              />
              <div className="relative flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {band.weekIndex + 1}주차
                  {band.isPartial && (
                    <span className="ml-1 rounded bg-slate-200 px-1 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                      부분 주
                    </span>
                  )}
                </span>
                <span className="flex items-baseline gap-2">
                  {band.income > 0 && (
                    <span className="text-sm font-semibold text-blue-600">+{formatKRW(band.income)}</span>
                  )}
                  <span className="text-lg font-bold text-rose-600">-{formatKRW(band.total)}</span>
                </span>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 bg-blue-50/40 p-1 dark:bg-blue-950/20">
              {band.weekIndex === 0 &&
                Array.from({ length: firstDayOffset }).map((_, i) => <div key={`empty-${i}`} />)}
              {bandDays.map((day) => {
                const intensity = day.spending > 0 ? 0.1 + (day.spending / maxSpending) * 0.5 : 0
                return (
                  <button
                    key={day.date}
                    onClick={() => onDayClick(day.date)}
                    className="rounded-md p-2 text-left text-xs hover:ring-2 hover:ring-blue-300 dark:hover:ring-accent/50"
                    style={{ backgroundColor: intensity > 0 ? `rgba(225, 29, 72, ${intensity})` : 'transparent' }}
                  >
                    <div className="font-medium text-slate-700 dark:text-slate-200">{Number(day.date.slice(-2))}</div>
                    {day.income > 0 && <div className="text-blue-600">+{formatKRW(day.income)}</div>}
                    {day.spending > 0 && <div className="text-rose-600">-{formatKRW(day.spending)}</div>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
