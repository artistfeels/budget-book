import { categoryTrendRanking } from '../../lib/analyticsAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface CategoryTrendRankingProps {
  transactions: Transaction[]
  month: string
}

export default function CategoryTrendRanking({ transactions, month }: CategoryTrendRankingProps) {
  const trends = categoryTrendRanking(transactions, month)
  const increases = trends.filter((t) => t.changeAmount > 0).slice(0, 3)
  const decreases = [...trends]
    .reverse()
    .filter((t) => t.changeAmount < 0)
    .slice(0, 3)

  return (
    <div className="card animate-fade-up p-6">
      <p className="card-title mb-5">카테고리 증감 랭킹 ({month} 기준, 직전 3개월 평균 대비)</p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium text-spending">증가</p>
          {increases.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">증가한 카테고리가 없어요.</p>
          ) : (
            <ul className="space-y-1.5">
              {increases.map((t) => (
                <li key={t.category} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-200">{t.category}</span>
                  <span className="text-spending">+{formatKRW(t.changeAmount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-income">감소</p>
          {decreases.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">감소한 카테고리가 없어요.</p>
          ) : (
            <ul className="space-y-1.5">
              {decreases.map((t) => (
                <li key={t.category} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-200">{t.category}</span>
                  <span className="text-income">{formatKRW(t.changeAmount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
