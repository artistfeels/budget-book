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
      return {
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        color: isDark ? '#98989d' : '#6e6e73',
      }
    }
    const intensity = 0.1 + (value / maxAmount) * 0.8
    // Text flips to white only once the cell is dark enough to need it; below that the default
    // ink stays more readable than white-on-pale-pink.
    return { backgroundColor: `rgba(225, 29, 72, ${intensity})`, color: intensity > 0.45 ? '#fff' : undefined }
  }

  return (
    <div className="card animate-fade-up p-6">
      <p className="card-title mb-5">카테고리별 월간 히트맵</p>
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
                    <td
                      key={month}
                      className="rounded-md p-2 text-center tabular-nums"
                      style={cellStyle(value)}
                      title={formatKRW(value)}
                    >
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
