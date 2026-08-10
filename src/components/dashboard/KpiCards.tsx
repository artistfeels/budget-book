import { formatKRW, formatManwon } from '../../lib/format'

interface KpiCardsProps {
  income: number
  spending: number
  saving: number
  netCashFlow: number
  savingsRate: number | null
  compact: boolean
  onToggleCompact: () => void
}

export default function KpiCards({
  income,
  spending,
  saving,
  netCashFlow,
  savingsRate,
  compact,
  onToggleCompact,
}: KpiCardsProps) {
  const fmt = compact ? formatManwon : formatKRW

  const cards = [
    { label: '총수입', value: income, color: 'text-blue-600' },
    { label: '소비지출', value: spending, color: 'text-rose-600' },
    { label: '저축·투자', value: saving, color: 'text-emerald-600' },
    {
      label: '실질 저축률',
      value: savingsRate === null ? '—' : `${(savingsRate * 100).toFixed(1)}%`,
      color: 'text-slate-800 dark:text-slate-100',
    },
    {
      label: '순현금흐름',
      value: netCashFlow,
      color: netCashFlow >= 0 ? 'text-blue-600' : 'text-rose-600',
    },
  ]

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <input type="checkbox" checked={compact} onChange={onToggleCompact} />
          만원 단위로 표시
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
          >
            <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">{card.label}</p>
            <p className={`text-xl font-bold ${card.color}`}>
              {typeof card.value === 'number' ? fmt(card.value) : card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
