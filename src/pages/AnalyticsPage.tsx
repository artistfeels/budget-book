import { useMemo, useState } from 'react'
import { useTransactionStore } from '../store/useTransactionStore'
import { listAvailableMonths, summarizeByMonth } from '../lib/aggregations'
import { generateInsights, latestMonthWithSpending } from '../lib/analyticsAggregations'
import InsightFeed from '../components/analytics/InsightFeed'
import WeekdayChart from '../components/analytics/WeekdayChart'
import HourBucketChart from '../components/analytics/HourBucketChart'
import CategoryTrendRanking from '../components/analytics/CategoryTrendRanking'
import SubscriptionList from '../components/analytics/SubscriptionList'
import SavingsSimulator from '../components/analytics/SavingsSimulator'

type Period = 'all' | '6m' | '12m'

export default function AnalyticsPage() {
  const transactions = useTransactionStore((s) => s.transactions)
  const [period, setPeriod] = useState<Period>('12m')

  const availableMonths = useMemo(() => listAvailableMonths(transactions), [transactions])
  // The user's own month choice always wins; `defaultMonth` only fills in before they've picked one
  // (or after the data set changes and no explicit choice has been made yet).
  const defaultMonth = useMemo(
    () => latestMonthWithSpending(transactions, availableMonths),
    [transactions, availableMonths]
  )
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(undefined)
  const month = selectedMonth ?? defaultMonth

  const monthlySummaries = useMemo(() => summarizeByMonth(transactions), [transactions])

  const selectedMonths = useMemo(() => {
    if (period === 'all') return availableMonths
    const count = period === '6m' ? 6 : 12
    return availableMonths.slice(-count)
  }, [availableMonths, period])

  const periodTransactions = useMemo(
    () => transactions.filter((t) => selectedMonths.includes(t.date.slice(0, 7))),
    [transactions, selectedMonths]
  )

  const insights = useMemo(
    () => (month ? generateInsights(transactions, month, monthlySummaries) : []),
    [transactions, month, monthlySummaries]
  )

  if (!month) {
    return (
      <div className="rounded-xl bg-white p-6 text-slate-500 shadow-sm">
        불러온 데이터가 없습니다. 먼저 데이터를 불러와주세요.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">분석</h1>
        <div className="flex flex-wrap items-center gap-3">
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
      </div>

      <div className="mb-6">
        <InsightFeed insights={insights} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <WeekdayChart transactions={periodTransactions} />
        <HourBucketChart transactions={periodTransactions} />
      </div>

      <div className="mb-6">
        <CategoryTrendRanking transactions={transactions} month={month} />
      </div>

      <div className="mb-6">
        <SubscriptionList transactions={periodTransactions} />
      </div>

      <div>
        <SavingsSimulator transactions={transactions} month={month} monthlySummaries={monthlySummaries} />
      </div>
    </div>
  )
}
