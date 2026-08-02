import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { weekdaySpending } from '../../lib/analyticsAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface WeekdayChartProps {
  transactions: Transaction[]
}

export default function WeekdayChart({ transactions }: WeekdayChartProps) {
  const data = weekdaySpending(transactions)

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-4 font-medium text-slate-700">요일별 지출</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="weekday" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => formatKRW(v)} tick={{ fontSize: 11 }} width={70} />
          <Tooltip formatter={(value: number) => formatKRW(value)} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="amount" fill="#2563eb" barSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
