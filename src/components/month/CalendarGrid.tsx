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

  const avgWeeklyTotal = useMemo(() => {
    if (bands.length === 0) return 0
    return bands.reduce((sum, b) => sum + b.total, 0) / bands.length
  }, [bands])

  const maxSpending = useMemo(() => Math.max(1, ...daily.map((d) => d.spending)), [daily])

  const firstDayOffset = useMemo(() => {
    if (daily.length === 0) return 0
    const dow = new Date(`${daily[0].date}T00:00:00`).getDay()
    return dow === 0 ? 6 : dow - 1 // Monday-start offset
  }, [daily])

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-3 grid grid-cols-7 text-center text-xs font-medium text-slate-500">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>
      {bands.map((band) => {
        const bandDays = daily.filter((d) => d.date >= band.startDate && d.date <= band.endDate)
        const delta = avgWeeklyTotal > 0 ? ((band.total - avgWeeklyTotal) / avgWeeklyTotal) * 100 : 0

        return (
          <div key={band.weekIndex} className="relative mb-1 rounded-lg" style={{ backgroundColor: 'rgba(37, 99, 235, 0.08)' }}>
            <div className="grid grid-cols-7 gap-1 p-1">
              {band.weekIndex === 0 &&
                Array.from({ length: firstDayOffset }).map((_, i) => <div key={`empty-${i}`} />)}
              {bandDays.map((day) => {
                const intensity = day.spending > 0 ? 0.1 + (day.spending / maxSpending) * 0.5 : 0
                return (
                  <button
                    key={day.date}
                    onClick={() => onDayClick(day.date)}
                    className="rounded-md p-2 text-left text-xs hover:ring-2 hover:ring-blue-300"
                    style={{ backgroundColor: intensity > 0 ? `rgba(225, 29, 72, ${intensity})` : 'transparent' }}
                  >
                    <div className="font-medium text-slate-700">{Number(day.date.slice(-2))}</div>
                    {day.income > 0 && <div className="text-blue-600">+{formatKRW(day.income)}</div>}
                    {day.spending > 0 && <div className="text-rose-600">-{formatKRW(day.spending)}</div>}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between px-2 pb-1 text-xs text-slate-500">
              <span>
                {band.weekIndex + 1}주차 · 지출 {formatKRW(band.total)}
                {band.isPartial && <span className="ml-1 rounded bg-slate-200 px-1 text-slate-500">부분 주</span>}
              </span>
              {avgWeeklyTotal > 0 && (
                <span className={delta >= 0 ? 'text-rose-600' : 'text-emerald-600'}>
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
