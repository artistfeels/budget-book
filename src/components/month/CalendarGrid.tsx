import { useMemo } from 'react'
import { dailySummaries, spendingIntensity, weeklySpendingBands } from '../../lib/monthDetailAggregations'
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
    <div className="card animate-fade-up p-6">
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
            className="mb-2.5 overflow-hidden rounded-xl border border-black/[0.06] dark:border-white/[0.07]"
          >
            <div className="relative px-3.5 py-2.5">
              <div
                className="absolute inset-y-0 left-0 bg-spending/[0.07] transition-[width] duration-700 ease-spring dark:bg-spending/[0.14]"
                style={{ width: `${band.total > 0 ? weeklyBarWidth : 0}%` }}
              />
              <div className="relative flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {band.weekIndex + 1}주차
                  {band.isPartial && (
                    <span className="ml-1.5 rounded-full bg-black/[0.06] px-2 py-0.5 text-slate-500 dark:bg-white/[0.1] dark:text-slate-300">
                      부분 주
                    </span>
                  )}
                </span>
                <span className="flex items-baseline gap-2 tabular-nums">
                  {band.income > 0 && (
                    <span className="text-sm font-medium text-income">+{formatKRW(band.income)}</span>
                  )}
                  <span className="text-base font-semibold tracking-[-0.02em] text-spending">
                    -{formatKRW(band.total)}
                  </span>
                </span>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 border-t border-black/[0.04] bg-black/[0.015] p-1 dark:border-white/[0.05] dark:bg-white/[0.02]">
              {band.weekIndex === 0 &&
                Array.from({ length: firstDayOffset }).map((_, i) => <div key={`empty-${i}`} />)}
              {bandDays.map((day) => {
                const intensity = spendingIntensity(day.spending, maxSpending)
                return (
                  <button
                    key={day.date}
                    onClick={() => onDayClick(day.date)}
                    className="rounded-lg p-2 text-left text-xs tabular-nums transition-all duration-200 ease-spring hover:scale-[1.04] hover:ring-2 hover:ring-accent/40"
                    style={{ backgroundColor: intensity > 0 ? `rgba(225, 29, 72, ${intensity})` : 'transparent' }}
                  >
                    <div className="font-medium text-slate-700 dark:text-slate-200">{Number(day.date.slice(-2))}</div>
                    {day.income > 0 && <div className="text-income">+{formatKRW(day.income)}</div>}
                    {day.spending > 0 && <div className="text-spending">-{formatKRW(day.spending)}</div>}
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
