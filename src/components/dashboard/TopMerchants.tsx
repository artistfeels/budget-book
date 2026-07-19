import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { topMerchants } from '../../lib/dashboardAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface TopMerchantsProps {
  transactions: Transaction[]
}

export default function TopMerchants({ transactions }: TopMerchantsProps) {
  const items = topMerchants(transactions, 10)

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-4 font-medium text-slate-700">Top 10 가맹점</p>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={items} layout="vertical" margin={{ left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" tickFormatter={(v) => formatKRW(v)} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={100} />
          <Tooltip formatter={(value: number) => formatKRW(value)} />
          <Bar dataKey="amount" fill="#e11d48" barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
