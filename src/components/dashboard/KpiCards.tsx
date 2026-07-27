import { formatKRW, formatManwon } from '../../lib/format'
import { monthOverMonthChange } from '../../lib/aggregations'

interface KpiCardsProps {
  income: number
  spending: number
  saving: number
  netCashFlow: number
  savingsRate: number | null
  previousIncome: number | null
  previousSpending: number | null
  previousSaving: number | null
  compact: boolean
  onToggleCompact: () => void
}

function DeltaBadge({
  current,
  previous,
  higherIsBetter,
}: {
  current: number
  previous: number | null
  higherIsBetter: boolean
}) {
  if (previous === null) return null
  const change = monthOverMonthChange(current, previous)
  if (change === null) return null
  const isUp = change > 0
  const isGood = isUp === higherIsBetter
  return (
    <span className={`ml-2 text-xs font-medium ${isGood ? 'text-emerald-600' : 'text-rose-600'}`}>
      {isUp ? '▲' : '▼'} {Math.abs(change * 100).toFixed(1)}%
    </span>
  )
}

export default function KpiCards({
  income,
  spending,
  saving,
  netCashFlow,
  savingsRate,
  previousIncome,
  previousSpending,
  previousSaving,
  compact,
  onToggleCompact,
}: KpiCardsProps) {
  const fmt = compact ? formatManwon : formatKRW

  const cards = [
    { label: '총수입', value: income, color: 'text-blue-600', previous: previousIncome, higherIsBetter: true },
    { label: '소비지출', value: spending, color: 'text-rose-600', previous: previousSpending, higherIsBetter: false },
    { label: '저축·투자', value: saving, color: 'text-emerald-600', previous: previousSaving, higherIsBetter: true },
    {
      label: '실질 저축률',
      value: savingsRate === null ? '—' : `${(savingsRate * 100).toFixed(1)}%`,
      color: 'text-slate-800',
      previous: null,
      higherIsBetter: true,
    },
    {
      label: '순현금흐름',
      value: netCashFlow,
      color: netCashFlow >= 0 ? 'text-blue-600' : 'text-rose-600',
      previous: null,
      higherIsBetter: true,
    },
  ]

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input type="checkbox" checked={compact} onChange={onToggleCompact} />
          만원 단위로 표시
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl bg-white p-5 shadow-sm">
            <p className="mb-2 text-sm text-slate-500">{card.label}</p>
            <p className={`text-xl font-bold ${card.color}`}>
              {typeof card.value === 'number' ? fmt(card.value) : card.value}
              {typeof card.value === 'number' && card.previous !== null && (
                <DeltaBadge current={card.value} previous={card.previous} higherIsBetter={card.higherIsBetter} />
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
