import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { categoryBreakdown } from '../../lib/dashboardAggregations'
import { formatKRW } from '../../lib/format'
import { useChartTheme } from '../../lib/useChartTheme'
import type { Transaction } from '../../types/transaction'

interface MonthCategoryChartProps {
  transactions: Transaction[]
  month: string
}

export default function MonthCategoryChart({ transactions, month }: MonthCategoryChartProps) {
  const monthTransactions = transactions.filter((t) => t.date.slice(0, 7) === month)
  const items = categoryBreakdown(monthTransactions)
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  const theme = useChartTheme()

  return (
    <div className="card animate-fade-up p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="card-title">월간 항목별 지출 ({month})</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          총{' '}
          <span className="font-semibold tabular-nums tracking-[-0.01em] text-slate-900 dark:text-white">
            {formatKRW(total)}
          </span>
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">이 달에는 지출 데이터가 없습니다.</p>
      ) : (
        // Category-only data (no total row mixed in) so bar length reads as a relative
        // scale — the biggest category naturally fills the chart width, others scale against it.
        <ResponsiveContainer width="100%" height={Math.max(240, items.length * 32)}>
          <BarChart data={items} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
            <XAxis type="number" tickFormatter={(v) => formatKRW(v)} tick={{ fontSize: 11, fill: theme.axisTick }} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: theme.axisTick }} width={90} />
            <Tooltip formatter={(value: number) => formatKRW(value)} contentStyle={theme.tooltipContentStyle} />
            <Bar dataKey="amount" fill={theme.series.blue} barSize={16} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
