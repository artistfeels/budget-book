import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { categoryBreakdown } from '../../lib/dashboardAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface MonthCategoryChartProps {
  transactions: Transaction[]
  month: string
}

export default function MonthCategoryChart({ transactions, month }: MonthCategoryChartProps) {
  const monthTransactions = transactions.filter((t) => t.date.slice(0, 7) === month)
  const items = categoryBreakdown(monthTransactions)
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  const data = [{ label: '지출 총계', amount: total }, ...items]

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-4 font-medium text-slate-700">월간 항목별 지출 ({month})</p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">이 달에는 지출 데이터가 없습니다.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(280, data.length * 32)}>
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tickFormatter={(v) => formatKRW(v)} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={90} />
            <Tooltip formatter={(value: number) => formatKRW(value)} />
            <Bar dataKey="amount" barSize={16} radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell key={d.label} fill={i === 0 ? '#0f172a' : '#94a3b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
