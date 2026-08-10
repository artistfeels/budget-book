import { useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { applyPendingCostFloor, spendingPaceSeries } from '../../lib/monthDetailAggregations'
import { detectSubscriptions } from '../../lib/analyticsAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface SpendingPaceChartProps {
  transactions: Transaction[]
  month: string
}

export default function SpendingPaceChart({ transactions, month }: SpendingPaceChartProps) {
  const [year, monthNum] = month.split('-').map(Number)
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  const now = new Date()
  // Compare against a locally-derived month string, not toISOString() (UTC) — otherwise this
  // mismatches with new Date().getDate() (local) for part of the day around month boundaries.
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const isCurrentMonth = month === currentMonth
  const asOfDay = isCurrentMonth ? now.getDate() : daysInMonth

  const result = useMemo(() => spendingPaceSeries(transactions, month, asOfDay), [transactions, month, asOfDay])
  const clampedAsOfDay = result.asOfDay

  // Detected recurring merchants that haven't posted this month yet are a near-certain remaining
  // cost (e.g. rent due on the 23rd) — use their known amount as a floor under the statistical
  // projection so a quiet start to the month can't make the estimate implausibly low. Merchant-
  // level (not category-level) on purpose: a category-wide check flagged almost every category
  // with any 2-of-3-month history as "pending", which is most categories for a normal spender.
  const subscriptions = useMemo(() => detectSubscriptions(transactions), [transactions])
  const monthMerchants = useMemo(
    () => new Set(transactions.filter((t) => t.date.slice(0, 7) === month).map((t) => t.content)),
    [transactions, month]
  )
  const pendingSubscriptions = useMemo(
    () => subscriptions.filter((s) => !monthMerchants.has(s.merchant)),
    [subscriptions, monthMerchants]
  )
  const pendingTotal = useMemo(
    () => pendingSubscriptions.reduce((sum, s) => sum + s.amount, 0),
    [pendingSubscriptions]
  )

  const isMonthInProgress = clampedAsOfDay < daysInMonth

  // Keep the projected LINE consistent with the headline total: a pending subscription's known
  // amount lands as a step exactly on its typical due date (e.g. rent on the 23rd), not smoothed
  // evenly across the remaining days.
  const { points: chartPoints, projectedMonthEndTotal: projectedTotal } = useMemo(
    () => applyPendingCostFloor(result.points, clampedAsOfDay, daysInMonth, pendingSubscriptions),
    [result.points, clampedAsOfDay, daysInMonth, pendingSubscriptions]
  )

  const isFaster = (result.percentVsLastMonthSameDay ?? 0) > 0

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-1 font-medium text-slate-700">지출 속도 (Spending Pace)</p>
      <div className="mb-4">
        <p className="text-sm font-medium">
          <span className={isFaster ? 'text-rose-600' : 'text-emerald-600'}>
            {result.percentVsLastMonthSameDay === null
              ? '비교할 지난달 데이터가 없습니다.'
              : `지난달 같은 날 대비 ${isFaster ? '+' : ''}${(result.percentVsLastMonthSameDay * 100).toFixed(0)}% ${
                  isFaster ? '빠름' : '느림'
                }`}
          </span>
          {' · 이 속도면 월말 예상 '}
          <span className="font-bold text-slate-800">{formatKRW(Math.round(projectedTotal))}</span>
        </p>
        {isMonthInProgress && pendingSubscriptions.length > 0 && (
          <p className="mt-1 text-xs text-slate-400">
            아직 안 나간 구독·정기결제 확정 {formatKRW(pendingTotal)}이 반영되어 있어요 (
            {pendingSubscriptions.map((s) => `${s.merchant} ${formatKRW(s.amount)}`).join(', ')})
          </p>
        )}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartPoints}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v) => formatKRW(v)} tick={{ fontSize: 11 }} width={80} />
          <Tooltip
            formatter={(value: any) => (value === null ? '-' : formatKRW(value))}
            labelFormatter={(day) => `${day}일`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="threeMonthAvg" name="최근 3개월 평균" stroke="#2a78d6" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="lastMonth" name="지난달" stroke="#eb6834" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          <Line type="monotone" dataKey="thisMonth" name="이번 달" stroke="#1baf7a" strokeWidth={2.5} dot={false} />
          <Line
            type="monotone"
            dataKey="thisMonthProjected"
            name="이번 달 예상"
            stroke="#1baf7a"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-slate-400">
        {clampedAsOfDay}일까지 실제 데이터, 이후는 최근 3개월 지출 패턴에 이번 달 속도와 남은 구독료를 반영한 예상치입니다.
      </p>
    </div>
  )
}
