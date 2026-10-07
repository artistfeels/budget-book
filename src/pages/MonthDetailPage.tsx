import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { listAvailableMonths, summarizeByMonth } from '../lib/aggregations'
import { shiftMonth } from '../lib/month'
import { latestMonthWithSpending } from '../lib/analyticsAggregations'
import { useTransactionStore } from '../store/useTransactionStore'
import { usePreferencesStore } from '../store/usePreferencesStore'
import CalendarGrid from '../components/month/CalendarGrid'
import SpendingPaceChart from '../components/month/SpendingPaceChart'
import MonthSummaryCard from '../components/month/MonthSummaryCard'
import MonthInfographics from '../components/month/MonthInfographics'
import MonthCategoryChart from '../components/dashboard/MonthCategoryChart'
import DayTransactionPanel from '../components/month/DayTransactionPanel'

export default function MonthDetailPage() {
  const { yyyyMm } = useParams<{ yyyyMm: string }>()
  const navigate = useNavigate()
  const transactions = useTransactionStore((s) => s.transactions)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const showReportButton = usePreferencesStore((s) => s.showReportButton)
  const [exporting, setExporting] = useState(false)

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
        <div className="animate-fade-up stagger-1 flex items-center gap-2">
          {showReportButton && (
            <button
              type="button"
              disabled={exporting}
              onClick={async () => {
                setExporting(true)
                try {
                  const { exportMonthlyReport } = await import('../lib/report')
                  await exportMonthlyReport(transactions, month)
                } catch (error) {
                  console.error('Failed to export report:', error)
                  window.alert('리포트를 만들지 못했습니다. 잠시 후 다시 시도해주세요.')
                } finally {
                  setExporting(false)
                }
              }}
              title="이 달의 요약·카테고리·이상 지출·거래 내역을 엑셀로 저장 (설정에서 숨길 수 있어요)"
              className="btn-ghost inline-flex min-h-11 items-center gap-1.5 border border-black/[0.08] md:min-h-0 dark:border-white/[0.1]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              {exporting ? '만드는 중…' : '리포트'}
            </button>
          )}
          <select
            value={month}
            onChange={(e) => navigate(`/monthly/${e.target.value}`)}
            className="field font-medium"
          >
            {[...availableMonths].reverse().map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
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
