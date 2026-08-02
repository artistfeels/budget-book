import { useMemo, useState } from 'react'
import { categoryTrendRanking, projectAnnualSaving, simulateSavings } from '../../lib/analyticsAggregations'
import { formatKRW } from '../../lib/format'
import type { MonthlySummary } from '../../lib/aggregations'
import type { Transaction } from '../../types/transaction'

interface SavingsSimulatorProps {
  transactions: Transaction[]
  month: string
  monthlySummaries: MonthlySummary[]
}

export default function SavingsSimulator({ transactions, month, monthlySummaries }: SavingsSimulatorProps) {
  const trends = useMemo(() => categoryTrendRanking(transactions, month), [transactions, month])
  const categoryBaselines = useMemo(
    () => Object.fromEntries(trends.map((t) => [t.category, t.baselineAmount])),
    [trends]
  )
  const [reductionByCategory, setReductionByCategory] = useState<Record<string, number>>({})

  const baseProjection = useMemo(() => projectAnnualSaving(monthlySummaries), [monthlySummaries])
  const extraFromSimulation = useMemo(
    () => simulateSavings(categoryBaselines, reductionByCategory),
    [categoryBaselines, reductionByCategory]
  )

  function setReduction(category: string, percent: number) {
    setReductionByCategory((prev) => ({ ...prev, [category]: percent / 100 }))
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-1 font-medium text-slate-700">저축 시뮬레이터 ({month} 기준)</p>
      <p className="mb-4 text-2xl font-bold text-emerald-600">
        {formatKRW(baseProjection + extraFromSimulation)}
        <span className="ml-2 text-sm font-normal text-slate-400">연간 예상 저축액</span>
      </p>
      {Object.keys(categoryBaselines).length === 0 ? (
        <p className="text-sm text-slate-400">절감 시뮬레이션에 쓸 카테고리 데이터가 아직 없어요.</p>
      ) : (
        <ul className="space-y-3">
          {Object.entries(categoryBaselines).map(([category, baseline]) => (
            <li key={category}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-slate-700">{category}</span>
                <span className="text-slate-400">
                  {formatKRW(baseline)}/월 · {Math.round((reductionByCategory[category] ?? 0) * 100)}% 절감
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                step={5}
                value={Math.round((reductionByCategory[category] ?? 0) * 100)}
                onChange={(e) => setReduction(category, Number(e.target.value))}
                className="w-full"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
