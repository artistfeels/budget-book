import { formatKRW } from '../../lib/format'
import { monthOverMonthChange, type MonthlySummary } from '../../lib/aggregations'

interface MonthSummaryCardProps {
  current: MonthlySummary | undefined
  previous: MonthlySummary | undefined
}

export default function MonthSummaryCard({ current, previous }: MonthSummaryCardProps) {
  if (!current) {
    return <div className="rounded-xl bg-white p-6 shadow-sm text-sm text-slate-400">이 달에는 거래가 없습니다.</div>
  }

  const netSaving = current.income - current.spending
  const netChange = previous ? monthOverMonthChange(netSaving, previous.income - previous.spending) : null

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-4 font-medium text-slate-700">이 달 요약</p>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-slate-500">수입</p>
          <p className="text-lg font-bold text-blue-600">{formatKRW(current.income)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">지출</p>
          <p className="text-lg font-bold text-rose-600">{formatKRW(current.spending)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">순저축</p>
          <p className="text-lg font-bold text-emerald-600">
            {formatKRW(netSaving)}
            {netChange !== null && (
              <span className={`ml-1 text-xs ${netChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                ({netChange >= 0 ? '+' : ''}
                {(netChange * 100).toFixed(0)}%)
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
