import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MonthlySummary } from '../../lib/aggregations'
import { formatKRW, formatManwon } from '../../lib/format'

interface MonthlyTrendChartProps {
  summaries: MonthlySummary[]
  onSelectMonth?: (month: string) => void
}

export default function MonthlyTrendChart({ summaries, onSelectMonth }: MonthlyTrendChartProps) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-4 font-medium text-slate-700">월별 추이</p>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={summaries}
          onClick={(state) => {
            const month = state?.activeLabel
            if (typeof month === 'string') onSelectMonth?.(month)
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => formatManwon(v)} tick={{ fontSize: 12 }} width={70} />
          <Tooltip formatter={(value: number) => formatKRW(value)} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="income" name="수입" fill="#2563eb" barSize={24} />
          <Bar dataKey="spending" name="소비지출" stackId="outflow" fill="#e11d48" barSize={24} />
          <Bar dataKey="saving" name="저축·투자" stackId="outflow" fill="#059669" barSize={24} />
          <Line type="monotone" dataKey="netCashFlow" name="순현금흐름" stroke="#0f172a" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-slate-400">막대를 클릭하면 아래 월간 상세 위젯들이 그 달로 바뀝니다.</p>
    </div>
  )
}
