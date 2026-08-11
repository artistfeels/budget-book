import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MonthlySummary } from '../../lib/aggregations'
import { formatKRW, formatKRWCompact, formatManwon } from '../../lib/format'
import { niceAxisTicks } from '../../lib/chartTicks'
import { useChartTheme } from '../../lib/useChartTheme'
import { useMediaQuery } from '../../lib/useMediaQuery'

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
  const isDesktop = useMediaQuery('(min-width: 768px)')

  return (
    <div className="card animate-fade-up p-4 md:p-6">
      <p className="card-title mb-5">월별 추이</p>
      <ResponsiveContainer width="100%" height={isDesktop ? 320 : 240}>
        <ComposedChart
          data={summaries}
          onClick={(state) => {
            const month = state?.activeLabel
            if (typeof month === 'string') onSelectMonth?.(month)
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
          <XAxis
            dataKey="month"
            interval={isDesktop ? 0 : 'preserveStartEnd'}
            tick={{ fontSize: isDesktop ? 12 : 10, fill: theme.axisTick }}
          />
          <YAxis
            tickFormatter={(v) => (isDesktop ? formatManwon(v) : formatKRWCompact(v))}
            tick={{ fontSize: isDesktop ? 12 : 10, fill: theme.axisTick }}
            width={isDesktop ? 70 : 44}
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
