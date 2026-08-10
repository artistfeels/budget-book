import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { paymentMethodBreakdown } from '../../lib/dashboardAggregations'
import { formatKRW } from '../../lib/format'
import { useChartTheme } from '../../lib/useChartTheme'
import type { Transaction } from '../../types/transaction'

const COLORS = ['#2563eb', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d']

interface PaymentMethodPieProps {
  transactions: Transaction[]
}

export default function PaymentMethodPie({ transactions }: PaymentMethodPieProps) {
  const items = paymentMethodBreakdown(transactions).slice(0, 8)
  const theme = useChartTheme()

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <p className="mb-4 font-medium text-slate-700 dark:text-slate-200">결제수단별 지출 비중</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={items} dataKey="amount" nameKey="label" outerRadius={90} label={(entry) => entry.label}>
            {items.map((item, i) => (
              <Cell key={item.label} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => formatKRW(value)} contentStyle={theme.tooltipContentStyle} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
