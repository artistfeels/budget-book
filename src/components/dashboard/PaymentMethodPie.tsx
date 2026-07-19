import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { paymentMethodBreakdown } from '../../lib/dashboardAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

const COLORS = ['#2563eb', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d']

interface PaymentMethodPieProps {
  transactions: Transaction[]
}

export default function PaymentMethodPie({ transactions }: PaymentMethodPieProps) {
  const items = paymentMethodBreakdown(transactions).slice(0, 8)

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-4 font-medium text-slate-700">결제수단별 지출 비중</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={items} dataKey="amount" nameKey="label" outerRadius={90} label={(entry) => entry.label}>
            {items.map((item, i) => (
              <Cell key={item.label} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => formatKRW(value)} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
