import { formatKRW } from '../../lib/format'
import { monthOverMonthChange, type MonthlySummary } from '../../lib/aggregations'

interface MonthSummaryCardProps {
  current: MonthlySummary | undefined
  previous: MonthlySummary | undefined
}

export default function MonthSummaryCard({ current, previous }: MonthSummaryCardProps) {
  if (!current) {
    return (
      <div className="card animate-fade-up p-6 text-sm text-slate-400 dark:text-slate-500">
        이 달에는 거래가 없습니다.
      </div>
    )
  }

  const netSaving = current.income - current.spending
  const netChange = previous ? monthOverMonthChange(netSaving, previous.income - previous.spending) : null

  const items = [
    { label: '수입', value: current.income, color: 'text-income' },
    { label: '지출', value: current.spending, color: 'text-spending' },
    { label: '순저축', value: netSaving, color: 'text-saving' },
  ]

  return (
    <div className="card animate-fade-up p-6">
      <p className="card-title mb-5">이 달 요약</p>
      <div className="grid grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className={`text-xl font-semibold tracking-[-0.02em] ${item.color}`}>
              {formatKRW(item.value)}
              {item.label === '순저축' && netChange !== null && (
                <span
                  className={`ml-1.5 text-xs font-medium ${netChange >= 0 ? 'text-saving' : 'text-spending'}`}
                >
                  {netChange >= 0 ? '+' : ''}
                  {(netChange * 100).toFixed(0)}%
                </span>
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
