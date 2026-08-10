import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { weekdaySpending } from '../../lib/analyticsAggregations'
import { formatKRW } from '../../lib/format'
import { niceAxisTicks } from '../../lib/chartTicks'
import { useChartTheme } from '../../lib/useChartTheme'
import type { Transaction } from '../../types/transaction'

interface WeekdayChartProps {
  transactions: Transaction[]
}

export default function WeekdayChart({ transactions }: WeekdayChartProps) {
  const data = weekdaySpending(transactions)
  const yAxisTicks = niceAxisTicks(Math.max(0, ...data.map((d) => d.amount)))
  const theme = useChartTheme()

  return (
    <div className="card animate-fade-up p-6">
      <p className="card-title mb-5">요일별 지출</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
          <XAxis dataKey="weekday" tick={{ fontSize: 12, fill: theme.axisTick }} />
          <YAxis
            tickFormatter={(v) => formatKRW(v)}
            tick={{ fontSize: 11, fill: theme.axisTick }}
            width={70}
            domain={[0, yAxisTicks[yAxisTicks.length - 1]]}
            ticks={yAxisTicks}
          />
          <Tooltip formatter={(value: number) => formatKRW(value)} cursor={{ fill: theme.cursorFill }} contentStyle={theme.tooltipContentStyle} />
          <Bar dataKey="amount" fill="#2563eb" barSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
