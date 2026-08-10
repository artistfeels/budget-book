import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { hourBucketSpending } from '../../lib/analyticsAggregations'
import { formatKRW } from '../../lib/format'
import { niceAxisTicks } from '../../lib/chartTicks'
import { useChartTheme } from '../../lib/useChartTheme'
import type { Transaction } from '../../types/transaction'

interface HourBucketChartProps {
  transactions: Transaction[]
}

export default function HourBucketChart({ transactions }: HourBucketChartProps) {
  const data = hourBucketSpending(transactions)
  const yAxisTicks = niceAxisTicks(Math.max(0, ...data.map((d) => d.amount)))
  const theme = useChartTheme()

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <p className="mb-4 font-medium text-slate-700 dark:text-slate-200">시간대별 지출</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
          <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: theme.axisTick }} />
          <YAxis
            tickFormatter={(v) => formatKRW(v)}
            tick={{ fontSize: 11, fill: theme.axisTick }}
            width={70}
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
