import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="font-medium text-slate-700">월간 항목별 지출 ({month})</p>
        <p className="text-sm text-slate-500">
          총 <span className="font-bold text-slate-800">{formatKRW(total)}</span>
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">이 달에는 지출 데이터가 없습니다.</p>
      ) : (
        // Category-only data (no total row mixed in) so bar length reads as a relative
        // scale — the biggest category naturally fills the chart width, others scale against it.
        <ResponsiveContainer width="100%" height={Math.max(240, items.length * 32)}>
          <BarChart data={items} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tickFormatter={(v) => formatKRW(v)} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={90} />
            <Tooltip formatter={(value: number) => formatKRW(value)} />
            <Bar dataKey="amount" fill="#0f172a" barSize={16} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
