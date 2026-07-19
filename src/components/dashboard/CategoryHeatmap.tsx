import { useMemo } from 'react'
import { categoryMonthHeatmap } from '../../lib/dashboardAggregations'
import { formatKRW } from '../../lib/format'
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

  function cellStyle(value: number) {
    if (maxAmount === 0 || value === 0) return { backgroundColor: '#f8fafc' }
    const intensity = 0.1 + (value / maxAmount) * 0.8
    return { backgroundColor: `rgba(225, 29, 72, ${intensity})` }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-4 font-medium text-slate-700">카테고리별 월간 히트맵</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="p-2 text-left text-slate-500">대분류</th>
              {months.map((month) => (
                <th key={month} className="p-2 text-slate-500">
                  {month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category}>
                <td className="whitespace-nowrap p-2 font-medium text-slate-700">{category}</td>
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
