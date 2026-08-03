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

  const month = yyyyMm ?? defaultMonth

  if (!month) {
    return (
      <div className="rounded-xl bg-white p-6 text-slate-500 shadow-sm">
        불러온 데이터가 없습니다. 먼저 데이터를 불러와주세요.
      </div>
    )
  }

  const monthSummary = monthlySummaries.find((s) => s.month === month)
  const monthPreviousSummary = monthlySummaries.find((s) => s.month === shiftMonth(month, -1))

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">월간 상세</h1>
        <select
          value={month}
          onChange={(e) => navigate(`/monthly/${e.target.value}`)}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-800"
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
