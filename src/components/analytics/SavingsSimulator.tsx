import { useMemo, useState } from 'react'
import {
  categoryTrendRanking,
  projectAnnualSaving,
  simulateSavings,
  topSpendingCategories,
} from '../../lib/analyticsAggregations'
import { formatKRW } from '../../lib/format'
import type { MonthlySummary } from '../../lib/aggregations'
import type { Transaction } from '../../types/transaction'

interface SavingsSimulatorProps {
  transactions: Transaction[]
  month: string
  monthlySummaries: MonthlySummary[]
}

const REDUCTION_OPTIONS = [0, 10, 20, 30]
const MAX_CATEGORIES = 8

export default function SavingsSimulator({ transactions, month, monthlySummaries }: SavingsSimulatorProps) {
  const trends = useMemo(() => categoryTrendRanking(transactions, month), [transactions, month])
  const topCategories = useMemo(() => topSpendingCategories(trends, MAX_CATEGORIES), [trends])
  const categoryBaselines = useMemo(
    () => Object.fromEntries(topCategories.map((t) => [t.category, t.baselineAmount])),
    [topCategories]
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
      <p className="mb-1 text-sm text-slate-500">
        지금 추세면 연간 약 <span className="font-medium text-slate-700">{formatKRW(baseProjection)}</span>을
        저축해요. 아래에서 카테고리 지출을 줄여보면 얼마나 더 모을 수 있는지 확인할 수 있어요.
      </p>
      <p className="mb-4 text-2xl font-bold text-emerald-600">
        {formatKRW(baseProjection + extraFromSimulation)}
        <span className="ml-2 text-sm font-normal text-slate-400">
          연간 예상 저축액{extraFromSimulation > 0 && ` (+${formatKRW(extraFromSimulation)})`}
        </span>
      </p>
      {topCategories.length === 0 ? (
        <p className="text-sm text-slate-400">절감 시뮬레이션에 쓸 카테고리 데이터가 아직 없어요.</p>
      ) : (
        <ul className="space-y-4">
          {topCategories.map((t) => {
            const selected = Math.round((reductionByCategory[t.category] ?? 0) * 100)
            return (
              <li key={t.category}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-slate-700">{t.category}</span>
                  <span className="text-slate-400">{formatKRW(t.baselineAmount)}/월</span>
                </div>
                <div className="flex gap-2">
                  {REDUCTION_OPTIONS.map((percent) => {
                    const isSelected = selected === percent
                    const savedPerMonth = Math.round((t.baselineAmount * percent) / 100)
                    return (
                      <button
                        key={percent}
                        onClick={() => setReduction(t.category, percent)}
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {percent === 0 ? '유지' : `${percent}% (-${formatKRW(savedPerMonth)}/월)`}
                      </button>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
