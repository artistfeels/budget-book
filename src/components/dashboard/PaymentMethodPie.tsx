import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { paymentMethodBreakdown } from '../../lib/dashboardAggregations'
import { formatKRW } from '../../lib/format'
import { useChartTheme } from '../../lib/useChartTheme'
import { useMediaQuery } from '../../lib/useMediaQuery'
import type { Transaction } from '../../types/transaction'

const COLORS = ['#2563eb', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d']

interface PaymentMethodPieProps {
  transactions: Transaction[]
}

export default function PaymentMethodPie({ transactions }: PaymentMethodPieProps) {
  const items = paymentMethodBreakdown(transactions).slice(0, 8)
  const theme = useChartTheme()
  const isDesktop = useMediaQuery('(min-width: 768px)')

  return (
    <div className="card animate-fade-up p-4 md:p-6">
      <p className="card-title mb-5">결제수단별 지출 비중</p>
      <ResponsiveContainer width="100%" height={isDesktop ? 240 : 200}>
        <PieChart>
          {/* Slice labels are dropped on phones — at this width they collide into an unreadable
              ring, and the tooltip already names the slice on tap. */}
          <Pie
            data={items}
            dataKey="amount"
            nameKey="label"
            outerRadius={isDesktop ? 90 : 70}
            label={isDesktop ? (entry) => entry.label : false}
          >
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
