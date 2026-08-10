import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listAvailableMonths, summarizeByMonth } from '../lib/aggregations'
import { useTransactionStore } from '../store/useTransactionStore'
import KpiCards from '../components/dashboard/KpiCards'
import MonthlyTrendChart from '../components/dashboard/MonthlyTrendChart'
import CategoryDonut from '../components/dashboard/CategoryDonut'
import PaymentMethodPie from '../components/dashboard/PaymentMethodPie'

type Period = '1m' | '3m' | '6m' | '12m'

const PERIOD_OPTIONS: { value: Period; label: string; months: number }[] = [
  { value: '1m', label: '최근 1개월', months: 1 },
  { value: '3m', label: '최근 3개월', months: 3 },
  { value: '6m', label: '최근 6개월', months: 6 },
  { value: '12m', label: '최근 12개월', months: 12 },
]

export default function DashboardPage() {
  const transactions = useTransactionStore((s) => s.transactions)
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Period>('12m')
  const [compact, setCompact] = useState(false)

  const availableMonths = useMemo(() => listAvailableMonths(transactions), [transactions])
  const monthlySummaries = useMemo(() => summarizeByMonth(transactions), [transactions])

  const selectedMonths = useMemo(() => {
    const count = PERIOD_OPTIONS.find((p) => p.value === period)?.months ?? 12
    return availableMonths.slice(-count)
  }, [availableMonths, period])

  const summariesInPeriod = useMemo(
    () => monthlySummaries.filter((s) => selectedMonths.includes(s.month)),
    [monthlySummaries, selectedMonths]
  )

  const periodTransactions = useMemo(
    () => transactions.filter((t) => selectedMonths.includes(t.date.slice(0, 7))),
    [transactions, selectedMonths]
  )

  const totals = useMemo(() => {
    const income = summariesInPeriod.reduce((sum, s) => sum + s.income, 0)
    const spending = summariesInPeriod.reduce((sum, s) => sum + s.spending, 0)
    const saving = summariesInPeriod.reduce((sum, s) => sum + s.saving, 0)
    const netCashFlow = income - spending
    const savingsRate = income > 0 ? saving / income : null
    return { income, spending, saving, netCashFlow, savingsRate }
  }, [summariesInPeriod])

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title animate-fade-up">대시보드</h1>
        <div className="segmented animate-fade-up stagger-1">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              aria-pressed={period === p.value}
              className={`btn-ghost ${period === p.value ? 'btn-ghost-active' : ''}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <KpiCards
        income={totals.income}
        spending={totals.spending}
        saving={totals.saving}
        netCashFlow={totals.netCashFlow}
        savingsRate={totals.savingsRate}
        compact={compact}
        onToggleCompact={() => setCompact((c) => !c)}
      />

      <div className="mt-6">
        <MonthlyTrendChart summaries={summariesInPeriod} onSelectMonth={(month) => navigate(`/monthly/${month}`)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CategoryDonut transactions={periodTransactions} />
        <PaymentMethodPie transactions={periodTransactions} />
      </div>
    </div>
  )
}
