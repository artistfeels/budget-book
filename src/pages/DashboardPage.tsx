import { useMemo, useState } from 'react'
import { listAvailableMonths, summarizeByMonth } from '../lib/aggregations'
import { useTransactionStore } from '../store/useTransactionStore'
import KpiCards from '../components/dashboard/KpiCards'
import MonthlyTrendChart from '../components/dashboard/MonthlyTrendChart'
import CategoryDonut from '../components/dashboard/CategoryDonut'

type Period = 'all' | '6m' | '12m'

export default function DashboardPage() {
  const transactions = useTransactionStore((s) => s.transactions)
  const [period, setPeriod] = useState<Period>('12m')
  const [compact, setCompact] = useState(false)

  const availableMonths = useMemo(() => listAvailableMonths(transactions), [transactions])

  const selectedMonths = useMemo(() => {
    if (period === 'all') return availableMonths
    const count = period === '6m' ? 6 : 12
    return availableMonths.slice(-count)
  }, [availableMonths, period])

  const monthlySummaries = useMemo(() => summarizeByMonth(transactions), [transactions])

  const summariesInPeriod = useMemo(
    () => monthlySummaries.filter((s) => selectedMonths.includes(s.month)),
    [monthlySummaries, selectedMonths]
  )

  const totals = useMemo(() => {
    const income = summariesInPeriod.reduce((sum, s) => sum + s.income, 0)
    const spending = summariesInPeriod.reduce((sum, s) => sum + s.spending, 0)
    const saving = summariesInPeriod.reduce((sum, s) => sum + s.saving, 0)
    const netCashFlow = income - spending - saving
    const savingsRate = income > 0 ? (income - spending) / income : null
    return { income, spending, saving, netCashFlow, savingsRate }
  }, [summariesInPeriod])

  const previousMonth = useMemo(() => {
    const lastTwo = monthlySummaries.slice(-2)
    return lastTwo.length === 2 ? lastTwo[0] : undefined
  }, [monthlySummaries])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">대시보드</h1>
        <div className="flex gap-2">
          {(['6m', '12m', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
                period === p ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:text-slate-800'
              }`}
            >
              {p === '6m' ? '최근 6개월' : p === '12m' ? '최근 12개월' : '전체'}
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
        previousIncome={previousMonth ? previousMonth.income : null}
        previousSpending={previousMonth ? previousMonth.spending : null}
        previousSaving={previousMonth ? previousMonth.saving : null}
        compact={compact}
        onToggleCompact={() => setCompact((c) => !c)}
      />

      <div className="mt-6">
        <MonthlyTrendChart summaries={summariesInPeriod} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CategoryDonut transactions={transactions.filter((t) => selectedMonths.includes(t.date.slice(0, 7)))} />
      </div>
    </div>
  )
}
