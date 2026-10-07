import { formatKRW, formatManwon } from '../../lib/format'
import { monthOverMonthChange, type MonthlySummary } from '../../lib/aggregations'
import { useMediaQuery } from '../../lib/useMediaQuery'

interface MonthSummaryCardProps {
  current: MonthlySummary | undefined
  previous: MonthlySummary | undefined
}

export default function MonthSummaryCard({ current, previous }: MonthSummaryCardProps) {
  // Three columns share ~93px each at 375px, where a full 3,956,038원 at text-xl wraps mid-number.
  // 만원 units keep the three-way comparison side by side, which is the point of this card.
  const isDesktop = useMediaQuery('(min-width: 768px)')

  if (!current) {
    return (
      <div className="card animate-fade-up p-4 md:p-6 text-sm text-slate-400 dark:text-slate-500">
        이달에는 거래가 없어요.
      </div>
    )
  }

  // Income minus spending — named and colored like the dashboard's 순현금흐름 so the same number
  // doesn't wear two names (it used to be '순저축' in savings-green here).
  const netCashFlow = current.income - current.spending
  const netChange = previous ? monthOverMonthChange(netCashFlow, previous.income - previous.spending) : null
  const fmt = isDesktop ? formatKRW : formatManwon

  const items = [
    { label: '수입', text: fmt(current.income), color: 'text-income' },
    { label: '지출', text: fmt(current.spending), color: 'text-spending' },
    {
      label: '순현금흐름',
      text: `${netCashFlow > 0 ? '+' : ''}${fmt(netCashFlow)}`,
      color: 'text-slate-900 dark:text-white',
    },
  ]

  return (
    <div className="card animate-fade-up p-4 md:p-6">
      <p className="card-title mb-5">이 달 요약</p>
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className={`text-base font-semibold tracking-[-0.02em] tabular-nums md:text-xl ${item.color}`}>
              {item.text}
              {item.label === '순현금흐름' && netChange !== null && (
                <span
                  className={`block text-xs font-medium md:ml-1.5 md:inline ${
                    netChange >= 0 ? 'text-saving' : 'text-spending'
                  }`}
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
