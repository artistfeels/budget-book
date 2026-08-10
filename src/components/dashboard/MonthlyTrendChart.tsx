import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MonthlySummary } from '../../lib/aggregations'
import { formatKRW, formatManwon } from '../../lib/format'
import { niceAxisTicks } from '../../lib/chartTicks'
import { useChartTheme } from '../../lib/useChartTheme'

interface MonthlyTrendChartProps {
  summaries: MonthlySummary[]
  onSelectMonth?: (month: string) => void
}

export default function MonthlyTrendChart({ summaries, onSelectMonth }: MonthlyTrendChartProps) {
  // income and spending+saving are separate bars (the latter stacked), so the tallest bar is
  // whichever of the two is bigger. The axis intentionally starts at 0, not at netCashFlow's
  // minimum — this dashboard reads as a magnitude comparison, not a signed range.
  const yAxisMax = Math.max(0, ...summaries.flatMap((s) => [s.income, s.spending + s.saving, s.netCashFlow]))
  const yAxisTicks = niceAxisTicks(yAxisMax)
  const theme = useChartTheme()

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <p className="mb-4 font-medium text-slate-700 dark:text-slate-200">월별 추이</p>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={summaries}
          onClick={(state) => {
            const month = state?.activeLabel
            if (typeof month === 'string') onSelectMonth?.(month)
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: theme.axisTick }} />
          <YAxis
            tickFormatter={(v) => formatManwon(v)}
            tick={{ fontSize: 12, fill: theme.axisTick }}
            width={70}
            domain={[yAxisTicks[0], yAxisTicks[yAxisTicks.length - 1]]}
            ticks={yAxisTicks}
          />
          <Tooltip formatter={(value: number) => formatKRW(value)} cursor={{ fill: theme.cursorFill }} contentStyle={theme.tooltipContentStyle} />
          <Bar dataKey="income" name="수입" fill="#2563eb" barSize={24} />
          <Bar dataKey="spending" name="소비지출" stackId="outflow" fill="#e11d48" barSize={24} />
          <Bar dataKey="saving" name="저축·투자" stackId="outflow" fill="#059669" barSize={24} />
          <Line type="monotone" dataKey="netCashFlow" name="순현금흐름" stroke={theme.ink} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">막대를 클릭하면 그 달의 월간 상세 화면으로 이동합니다.</p>
    </div>
  )
}
