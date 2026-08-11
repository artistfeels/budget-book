import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { categoryBreakdown, subcategoryBreakdown, type AmountBreakdownItem } from '../../lib/dashboardAggregations'
import { formatKRW } from '../../lib/format'
import { useChartTheme } from '../../lib/useChartTheme'
import { useMediaQuery } from '../../lib/useMediaQuery'
import type { Transaction } from '../../types/transaction'

const COLORS = ['#2563eb', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#475569', '#ea580c']

interface CategoryDonutProps {
  transactions: Transaction[]
}

export default function CategoryDonut({ transactions }: CategoryDonutProps) {
  const [drilldown, setDrilldown] = useState<string | null>(null)

  const items: AmountBreakdownItem[] = useMemo(
    () => (drilldown ? subcategoryBreakdown(transactions, drilldown) : categoryBreakdown(transactions)),
    [transactions, drilldown]
  )

  const total = items.reduce((sum, i) => sum + i.amount, 0)
  const theme = useChartTheme()
  const isDesktop = useMediaQuery('(min-width: 768px)')

  return (
    <div className="card animate-fade-up p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="card-title">
          지출 카테고리 구성 {drilldown && <span className="text-slate-400 dark:text-slate-500">/ {drilldown}</span>}
        </p>
        {drilldown && (
          <button onClick={() => setDrilldown(null)} className="text-sm text-accent hover:underline">
            ← 대분류로 돌아가기
          </button>
        )}
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="sm:w-1/2">
          <ResponsiveContainer width="100%" height={isDesktop ? 240 : 200}>
            <PieChart>
              <Pie
                data={items}
                dataKey="amount"
                nameKey="label"
                innerRadius={isDesktop ? 60 : 46}
                outerRadius={isDesktop ? 100 : 78}
                onClick={(entry) => {
                  if (!drilldown) setDrilldown(entry.label)
                }}
              >
                {items.map((item, i) => (
                  <Cell key={item.label} fill={COLORS[i % COLORS.length]} cursor={drilldown ? 'default' : 'pointer'} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatKRW(value)} contentStyle={theme.tooltipContentStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {items.map((item, i) => (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {item.label}
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                {formatKRW(item.amount)} ({total > 0 ? ((item.amount / total) * 100).toFixed(1) : '0'}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
