import { useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { blendSubscriptionProjection, spendingPaceSeries } from '../../lib/monthDetailAggregations'
import { detectSubscriptions } from '../../lib/analyticsAggregations'
import { formatKRW, formatKRWCompact } from '../../lib/format'
import { niceAxisTicks } from '../../lib/chartTicks'
import { useChartTheme } from '../../lib/useChartTheme'
import { useMediaQuery } from '../../lib/useMediaQuery'
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

  // Detected recurring merchants (subscriptions/bills) are excluded from the pace-scaled
  // statistical projection entirely — a fixed cost like rent shouldn't shrink just because this
  // month started quiet on coffee runs — and instead layered back on separately as a flat,
  // unscaled amount. Merchant-level (not category-level) detection on purpose: a category-wide
  // check flagged almost every category with any 2-of-3-month history as "pending", which is most
  // categories for a normal spender.
  const subscriptions = useMemo(() => detectSubscriptions(transactions), [transactions])
  const subscriptionMerchants = useMemo(() => new Set(subscriptions.map((s) => s.merchant)), [subscriptions])
  const nonSubscriptionTransactions = useMemo(
    () => transactions.filter((t) => !subscriptionMerchants.has(t.content)),
    [transactions, subscriptionMerchants]
  )
  const nonSubResult = useMemo(
    () => spendingPaceSeries(nonSubscriptionTransactions, month, asOfDay),
    [nonSubscriptionTransactions, month, asOfDay]
  )

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
  // Subscriptions that already posted this month are stripped out of nonSubResult's actual-so-far
  // too — this recovers exactly how much of the real total they account for, so it can be added
  // back as a flat offset instead of being subjected to pace scaling.
  const postedSubscriptionTotal =
    (result.points[clampedAsOfDay - 1]?.thisMonth ?? 0) - (nonSubResult.points[clampedAsOfDay - 1]?.thisMonth ?? 0)

  const isMonthInProgress = clampedAsOfDay < daysInMonth

  const { points: chartPoints, projectedMonthEndTotal: projectedTotal } = useMemo(
    () =>
      blendSubscriptionProjection(
        result.points,
        nonSubResult.points,
        clampedAsOfDay,
        daysInMonth,
        postedSubscriptionTotal,
        pendingSubscriptions
      ),
    [result.points, nonSubResult.points, clampedAsOfDay, daysInMonth, postedSubscriptionTotal, pendingSubscriptions]
  )

  const isFaster = (result.percentVsLastMonthSameDay ?? 0) > 0
  const theme = useChartTheme()
  const isDesktop = useMediaQuery('(min-width: 768px)')

  const yAxisMax = Math.max(
    0,
    ...chartPoints.flatMap((p) => [p.threeMonthAvg, p.lastMonth, p.thisMonth, p.thisMonthProjected].filter((v): v is number => v !== null))
  )
  const yAxisTicks = niceAxisTicks(yAxisMax)

  return (
    <div className="card animate-fade-up p-4 md:p-6">
      <p className="card-title mb-2">지출 속도 (Spending Pace)</p>
      <div className="mb-4">
        <p className="text-sm font-medium">
          <span className={isFaster ? 'text-spending' : 'text-saving'}>
            {result.percentVsLastMonthSameDay === null
              ? '비교할 지난달 데이터가 없습니다.'
              : `지난달 같은 날 대비 ${isFaster ? '+' : ''}${(result.percentVsLastMonthSameDay * 100).toFixed(0)}% ${
                  isFaster ? '빠름' : '느림'
                }`}
          </span>
          {' · 이 속도면 월말 예상 '}
          <span className="font-semibold tabular-nums tracking-[-0.01em] text-slate-900 dark:text-white">
            {formatKRW(Math.round(projectedTotal))}
          </span>
        </p>
        {isMonthInProgress && pendingSubscriptions.length > 0 && (
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            아직 안 나간 구독·정기결제 확정 {formatKRW(pendingTotal)}이 반영되어 있어요 (
            {pendingSubscriptions.map((s) => `${s.merchant} ${formatKRW(s.amount)}`).join(', ')})
          </p>
        )}
      </div>
      <ResponsiveContainer width="100%" height={isDesktop ? 280 : 220}>
        <LineChart data={chartPoints}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
          <XAxis
            dataKey="day"
            // undefined on desktop so recharts keeps its own default thinning; only the phone
            // needs the stricter start/end-only rule to stop labels colliding.
            interval={isDesktop ? undefined : 'preserveStartEnd'}
            tick={{ fontSize: isDesktop ? 11 : 10, fill: theme.axisTick }}
          />
          <YAxis
            tickFormatter={(v) => (isDesktop ? formatKRW(v) : formatKRWCompact(v))}
            tick={{ fontSize: isDesktop ? 11 : 10, fill: theme.axisTick }}
            width={isDesktop ? 80 : 44}
            domain={[0, yAxisTicks[yAxisTicks.length - 1]]}
            ticks={yAxisTicks}
          />
          <Tooltip
            formatter={(value: any) => (value === null ? '-' : formatKRW(value))}
            labelFormatter={(day) => `${day}일`}
            contentStyle={theme.tooltipContentStyle}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: theme.axisTick }} />
          <Line type="monotone" dataKey="threeMonthAvg" name="최근 3개월 평균" stroke={theme.series.blue} strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="lastMonth" name="지난달" stroke={theme.series.orange} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          <Line type="monotone" dataKey="thisMonth" name="이번 달" stroke={theme.series.aqua} strokeWidth={2.5} dot={false} />
          <Line
            type="monotone"
            dataKey="thisMonthProjected"
            name="이번 달 예상"
            stroke={theme.series.aqua}
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
        {clampedAsOfDay}일까지 실제 데이터, 이후는 최근 3개월 지출 패턴에 이번 달 속도와 남은 구독료를 반영한 예상치입니다.
      </p>
    </div>
  )
}
