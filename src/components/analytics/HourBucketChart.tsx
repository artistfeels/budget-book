import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { hourBucketSpending } from '../../lib/analyticsAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface HourBucketChartProps {
  transactions: Transaction[]
}

export default function HourBucketChart({ transactions }: HourBucketChartProps) {
  const data = hourBucketSpending(transactions)

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-4 font-medium text-slate-700">시간대별 지출</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => formatKRW(v)} tick={{ fontSize: 11 }} width={70} />
          <Tooltip formatter={(value: number) => formatKRW(value)} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="amount" fill="#7c3aed" barSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
