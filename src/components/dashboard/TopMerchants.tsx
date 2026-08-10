import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { topMerchants } from '../../lib/dashboardAggregations'
import { formatKRW } from '../../lib/format'
import { useChartTheme } from '../../lib/useChartTheme'
import type { Transaction } from '../../types/transaction'

interface TopMerchantsProps {
  transactions: Transaction[]
}

export default function TopMerchants({ transactions }: TopMerchantsProps) {
  const items = topMerchants(transactions, 10)
  const theme = useChartTheme()

  return (
    <div className="card animate-fade-up p-6">
      <p className="card-title mb-5">Top 10 가맹점</p>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={items} layout="vertical" margin={{ left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
          <XAxis type="number" tickFormatter={(v) => formatKRW(v)} tick={{ fontSize: 11, fill: theme.axisTick }} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: theme.axisTick }} width={100} />
          <Tooltip formatter={(value: number) => formatKRW(value)} contentStyle={theme.tooltipContentStyle} />
          <Bar dataKey="amount" fill="#e11d48" barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
