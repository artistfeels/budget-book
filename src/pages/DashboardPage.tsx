import { useMemo, useState } from 'react'
import { listAvailableMonths, summarizeByMonth } from '../lib/aggregations'
import { latestMonthWithSpending } from '../lib/analyticsAggregations'
import { useTransactionStore } from '../store/useTransactionStore'
import KpiCards from '../components/dashboard/KpiCards'
import MonthlyTrendChart from '../components/dashboard/MonthlyTrendChart'
import CategoryDonut from '../components/dashboard/CategoryDonut'
import PaymentMethodPie from '../components/dashboard/PaymentMethodPie'
import CalendarGrid from '../components/month/CalendarGrid'
import SpendingPaceChart from '../components/month/SpendingPaceChart'
import MonthSummaryCard from '../components/month/MonthSummaryCard'
import MonthInfographics from '../components/month/MonthInfographics'
import DayTransactionPanel from '../components/month/DayTransactionPanel'

type Period = '1m' | '3m' | '6m' | '12m'

const PERIOD_OPTIONS: { value: Period; label: string; months: number }[] = [
  { value: '1m', label: '최근 1개월', months: 1 },
  { value: '3m', label: '최근 3개월', months: 3 },
  { value: '6m', label: '최근 6개월', months: 6 },
  { value: '12m', label: '최근 12개월', months: 12 },
]

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function DashboardPage() {
  const transactions = useTransactionStore((s) => s.transactions)
  const [period, setPeriod] = useState<Period>('12m')
  const [compact, setCompact] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

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

  const previousMonth = useMemo(() => {
    const lastTwo = monthlySummaries.slice(-2)
    return lastTwo.length === 2 ? lastTwo[0] : undefined
  }, [monthlySummaries])

  // Month-detail widgets (calendar/pace/summary) are scoped to a single month,
  // independent of the period toggle above — same pattern as the analytics tab's month selector.
  const defaultMonth = useMemo(
    () => latestMonthWithSpending(transactions, availableMonths),
    [transactions, availableMonths]
  )
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(undefined)
  const month = selectedMonth ?? defaultMonth

  const monthSummary = monthlySummaries.find((s) => s.month === month)
  const monthPreviousSummary = month ? monthlySummaries.find((s) => s.month === shiftMonth(month, -1)) : undefined

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">대시보드</h1>
        <div className="flex gap-2">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
                period === p.value ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:text-slate-800'
              }`}
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
        previousIncome={previousMonth ? previousMonth.income : null}
        previousSpending={previousMonth ? previousMonth.spending : null}
        previousSaving={previousMonth ? previousMonth.saving : null}
        compact={compact}
        onToggleCompact={() => setCompact((c) => !c)}
      />

      {month && (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-bold text-slate-800">월간 상세</p>
            <select
              value={month}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-800"
            >
              {[...availableMonths].reverse().map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <MonthSummaryCard current={monthSummary} previous={monthPreviousSummary} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CalendarGrid transactions={transactions} month={month} onDayClick={setSelectedDay} />
            <SpendingPaceChart transactions={transactions} month={month} />
          </div>

          <div className="mt-6">
            <MonthInfographics transactions={transactions} month={month} />
          </div>
        </>
      )}

      <div className="mt-6">
        <MonthlyTrendChart summaries={summariesInPeriod} onSelectMonth={setSelectedMonth} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CategoryDonut transactions={periodTransactions} />
        <PaymentMethodPie transactions={periodTransactions} />
      </div>

      {selectedDay && (
        <DayTransactionPanel date={selectedDay} transactions={transactions} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  )
}
