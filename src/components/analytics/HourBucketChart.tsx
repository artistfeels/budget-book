import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { hourBucketSpending } from '../../lib/analyticsAggregations'
import { formatKRW, formatKRWCompact } from '../../lib/format'
import { niceAxisTicks } from '../../lib/chartTicks'
import { useChartTheme } from '../../lib/useChartTheme'
import { useMediaQuery } from '../../lib/useMediaQuery'
import type { Transaction } from '../../types/transaction'

interface HourBucketChartProps {
  transactions: Transaction[]
}

export default function HourBucketChart({ transactions }: HourBucketChartProps) {
  const data = hourBucketSpending(transactions)
  const yAxisTicks = niceAxisTicks(Math.max(0, ...data.map((d) => d.amount)))
  const theme = useChartTheme()
  const isDesktop = useMediaQuery('(min-width: 768px)')

  return (
    <div className="card animate-fade-up p-4 md:p-6">
      <p className="card-title mb-5">시간대별 지출</p>
      <ResponsiveContainer width="100%" height={isDesktop ? 240 : 200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
          <XAxis dataKey="bucket" tick={{ fontSize: isDesktop ? 12 : 10, fill: theme.axisTick }} />
          <YAxis
            tickFormatter={(v) => (isDesktop ? formatKRW(v) : formatKRWCompact(v))}
            tick={{ fontSize: isDesktop ? 11 : 10, fill: theme.axisTick }}
            width={isDesktop ? 70 : 44}
            domain={[0, yAxisTicks[yAxisTicks.length - 1]]}
            ticks={yAxisTicks}
          />
          <Tooltip formatter={(value: number) => formatKRW(value)} cursor={{ fill: theme.cursorFill }} contentStyle={theme.tooltipContentStyle} />
          <Bar dataKey="amount" fill="#7c3aed" barSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
