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

const STAGGER = ['stagger-1', 'stagger-2', 'stagger-3', 'stagger-4', 'stagger-5']

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
    { label: '총수입', value: income, color: 'text-income' },
    { label: '소비지출', value: spending, color: 'text-spending' },
    { label: '저축·투자', value: saving, color: 'text-saving' },
    {
      label: '실질 저축률',
      value: savingsRate === null ? '—' : `${(savingsRate * 100).toFixed(1)}%`,
      color: 'text-slate-900 dark:text-white',
    },
    {
      label: '순현금흐름',
      value: netCashFlow,
      color: netCashFlow >= 0 ? 'text-income' : 'text-spending',
    },
  ]

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={onToggleCompact}
          aria-pressed={compact}
          className={`btn-ghost text-xs ${compact ? 'btn-ghost-active' : ''}`}
        >
          만원 단위
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card, i) => (
          <div key={card.label} className={`card card-interactive animate-fade-up p-6 ${STAGGER[i]}`}>
            <p className="mb-3 text-[13px] font-medium tracking-[-0.005em] text-slate-500 dark:text-slate-400">
              {card.label}
            </p>
            <p className={`text-[26px] font-semibold leading-none tracking-[-0.02em] ${card.color}`}>
              {typeof card.value === 'number' ? fmt(card.value) : card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
