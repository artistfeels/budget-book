import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { topMerchants } from '../../lib/dashboardAggregations'
import { formatKRW, formatKRWCompact } from '../../lib/format'
import { useChartTheme } from '../../lib/useChartTheme'
import { useMediaQuery } from '../../lib/useMediaQuery'
import type { Transaction } from '../../types/transaction'

interface TopMerchantsProps {
  transactions: Transaction[]
}

export default function TopMerchants({ transactions }: TopMerchantsProps) {
  const items = topMerchants(transactions, 10)
  const theme = useChartTheme()
  const isDesktop = useMediaQuery('(min-width: 768px)')

  return (
    <div className="card animate-fade-up p-4 md:p-6">
      <p className="card-title mb-5">Top 10 가맹점</p>
      <ResponsiveContainer width="100%" height={isDesktop ? 320 : 240}>
        <BarChart data={items} layout="vertical" margin={{ left: isDesktop ? 40 : 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
          <XAxis
            type="number"
            tickFormatter={(v) => (isDesktop ? formatKRW(v) : formatKRWCompact(v))}
            tick={{ fontSize: 11, fill: theme.axisTick }}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: isDesktop ? 12 : 10, fill: theme.axisTick }}
            width={isDesktop ? 100 : 72}
          />
          <Tooltip formatter={(value: number) => formatKRW(value)} contentStyle={theme.tooltipContentStyle} />
          <Bar dataKey="amount" fill="#e11d48" barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
