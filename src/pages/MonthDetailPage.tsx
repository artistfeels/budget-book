import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { listAvailableMonths, summarizeByMonth } from '../lib/aggregations'
import { latestMonthWithSpending } from '../lib/analyticsAggregations'
import { useTransactionStore } from '../store/useTransactionStore'
import CalendarGrid from '../components/month/CalendarGrid'
import SpendingPaceChart from '../components/month/SpendingPaceChart'
import MonthSummaryCard from '../components/month/MonthSummaryCard'
import MonthInfographics from '../components/month/MonthInfographics'
import MonthCategoryChart from '../components/dashboard/MonthCategoryChart'
import DayTransactionPanel from '../components/month/DayTransactionPanel'

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function MonthDetailPage() {
  const { yyyyMm } = useParams<{ yyyyMm: string }>()
  const navigate = useNavigate()
  const transactions = useTransactionStore((s) => s.transactions)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const availableMonths = useMemo(() => listAvailableMonths(transactions), [transactions])
  const monthlySummaries = useMemo(() => summarizeByMonth(transactions), [transactions])
  const defaultMonth = useMemo(
    () => latestMonthWithSpending(transactions, availableMonths),
    [transactions, availableMonths]
  )

  // Ignore an invalid/unknown :yyyyMm (e.g. a stale or hand-edited URL) rather than rendering
  // a month selector with no matching option and blank widgets.
  const month = yyyyMm && availableMonths.includes(yyyyMm) ? yyyyMm : defaultMonth

  if (!month) {
    return (
      <div className="card animate-fade-up p-4 md:p-6 text-slate-500 dark:text-slate-400">
        불러온 데이터가 없습니다. 먼저 데이터를 불러와주세요.
      </div>
    )
  }

  const monthSummary = monthlySummaries.find((s) => s.month === month)
  const monthPreviousSummary = monthlySummaries.find((s) => s.month === shiftMonth(month, -1))

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 md:mb-8">
        <h1 className="page-title animate-fade-up">월간 상세</h1>
        <select
          value={month}
          onChange={(e) => navigate(`/monthly/${e.target.value}`)}
          className="field animate-fade-up stagger-1 font-medium"
        >
          {[...availableMonths].reverse().map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <MonthSummaryCard current={monthSummary} previous={monthPreviousSummary} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CalendarGrid transactions={transactions} month={month} onDayClick={setSelectedDay} />
        <SpendingPaceChart transactions={transactions} month={month} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MonthCategoryChart transactions={transactions} month={month} />
        <MonthInfographics transactions={transactions} month={month} />
      </div>

      {selectedDay && (
        <DayTransactionPanel date={selectedDay} transactions={transactions} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  )
}
