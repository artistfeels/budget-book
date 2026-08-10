import { useMemo } from 'react'
import { categoryMonthHeatmap } from '../../lib/dashboardAggregations'
import { formatKRW } from '../../lib/format'
import { useIsDark } from '../../lib/useChartTheme'
import type { Transaction } from '../../types/transaction'

interface CategoryHeatmapProps {
  transactions: Transaction[]
}

export default function CategoryHeatmap({ transactions }: CategoryHeatmapProps) {
  const { categories, months, amounts } = useMemo(() => categoryMonthHeatmap(transactions), [transactions])

  const maxAmount = useMemo(() => {
    let max = 0
    for (const category of categories) {
      for (const month of months) {
        max = Math.max(max, amounts[category]?.[month] ?? 0)
      }
    }
    return max
  }, [categories, months, amounts])

  const isDark = useIsDark()

  function cellStyle(value: number) {
    if (maxAmount === 0 || value === 0) {
      return { backgroundColor: isDark ? '#1e293b' : '#f8fafc', color: isDark ? '#94a3b8' : '#0f172a' }
    }
    const intensity = 0.1 + (value / maxAmount) * 0.8
    return { backgroundColor: `rgba(225, 29, 72, ${intensity})`, color: '#fff' }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <p className="mb-4 font-medium text-slate-700 dark:text-slate-200">카테고리별 월간 히트맵</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="p-2 text-left text-slate-500 dark:text-slate-400">대분류</th>
              {months.map((month) => (
                <th key={month} className="p-2 text-slate-500 dark:text-slate-400">
                  {month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category}>
                <td className="whitespace-nowrap p-2 font-medium text-slate-700 dark:text-slate-200">{category}</td>
                {months.map((month) => {
                  const value = amounts[category]?.[month] ?? 0
                  return (
                    <td key={month} className="p-2 text-center" style={cellStyle(value)} title={formatKRW(value)}>
                      {value > 0 ? formatKRW(value) : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
