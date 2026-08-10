import { useMemo, useState } from 'react'
import { useTransactionStore } from '../store/useTransactionStore'
import { listAvailableMonths, summarizeByMonth } from '../lib/aggregations'
import { generateInsights, latestMonthWithSpending } from '../lib/analyticsAggregations'
import InsightFeed from '../components/analytics/InsightFeed'
import WeekdayChart from '../components/analytics/WeekdayChart'
import HourBucketChart from '../components/analytics/HourBucketChart'
import CategoryTrendRanking from '../components/analytics/CategoryTrendRanking'
import SubscriptionList from '../components/analytics/SubscriptionList'
import CategoryHeatmap from '../components/dashboard/CategoryHeatmap'
import TopMerchants from '../components/dashboard/TopMerchants'

type Period = '1m' | '3m' | '6m' | '12m'

const PERIOD_OPTIONS: { value: Period; label: string; months: number }[] = [
  { value: '1m', label: '최근 1개월', months: 1 },
  { value: '3m', label: '최근 3개월', months: 3 },
  { value: '6m', label: '최근 6개월', months: 6 },
  { value: '12m', label: '최근 12개월', months: 12 },
]

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

  // Anchored on the selected month (not always the latest available month) — otherwise
  // picking an older month in the dropdown while a short period (e.g. 최근 1개월) is active
  // would silently show a *different*, more-recent month's data in the period-scoped widgets.
  const selectedMonths = useMemo(() => {
    const count = PERIOD_OPTIONS.find((p) => p.value === period)?.months ?? 12
    const anchorIndex = month ? availableMonths.indexOf(month) : -1
    if (anchorIndex === -1) return availableMonths.slice(-count)
    const start = Math.max(0, anchorIndex - count + 1)
    return availableMonths.slice(start, anchorIndex + 1)
  }, [availableMonths, period, month])

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
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:shadow-none">
        불러온 데이터가 없습니다. 먼저 데이터를 불러와주세요.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-50">분석</h1>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={month}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {[...availableMonths].reverse().map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
                  period === p.value
                    ? 'bg-accent text-white'
                    : 'bg-white text-slate-500 hover:text-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {p.label}
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
        <CategoryHeatmap transactions={periodTransactions} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TopMerchants transactions={periodTransactions} />
        {/* Full transaction history, not periodTransactions — detectSubscriptions needs its own
            multi-month trailing window regardless of the period toggle, same as CategoryTrendRanking above. */}
        <SubscriptionList transactions={transactions} />
      </div>
    </div>
  )
}
