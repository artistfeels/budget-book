import { useMemo } from 'react'
import { detectCategoryAnomalies, detectLargeTransactions } from '../../lib/anomalies'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface AnomalyCardProps {
  transactions: Transaction[]
  month: string
}

function formatRatio(ratio: number | null): string {
  return ratio === null ? '새로 생김' : `평소의 ${ratio.toFixed(1)}배`
}

export default function AnomalyCard({ transactions, month }: AnomalyCardProps) {
  const categories = useMemo(() => detectCategoryAnomalies(transactions, month), [transactions, month])
  const large = useMemo(() => detectLargeTransactions(transactions, month), [transactions, month])
  const empty = categories.length === 0 && large.length === 0

  return (
    <div className="card animate-fade-up p-4 md:p-6">
      <p className="card-title mb-1">이상 지출 감지</p>
      <p className="mb-5 text-xs text-slate-400 dark:text-slate-500">
        {month} 기준 · 직전 최대 6개월의 중앙값과 비교해 크게 벗어난 지출만 보여줘요
      </p>
      {empty ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">
          평소와 크게 다른 지출이 없어요. (비교하려면 최소 3개월치 데이터가 필요해요)
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">카테고리</p>
            {categories.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">튀는 카테고리가 없어요.</p>
            ) : (
              <ul className="space-y-2">
                {categories.map((a) => (
                  <li key={a.category} className="rounded-xl bg-black/[0.03] px-3.5 py-2.5 dark:bg-white/[0.04]">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">{a.category}</span>
                      <span className="shrink-0 tabular-nums text-spending">{formatKRW(a.currentAmount)}</span>
                    </div>
                    <div className="mt-0.5 flex justify-between gap-3 text-xs text-slate-400 dark:text-slate-500">
                      <span>{a.typicalAmount > 0 ? `평소 ${formatKRW(a.typicalAmount)}` : '평소 지출 없음'}</span>
                      <span>{formatRatio(a.ratio)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">큰 결제</p>
            {large.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">평소보다 유독 큰 결제가 없어요.</p>
            ) : (
              <ul className="space-y-2">
                {large.map((a) => (
                  <li key={a.transaction.id} className="rounded-xl bg-black/[0.03] px-3.5 py-2.5 dark:bg-white/[0.04]">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">
                        {a.transaction.content}
                      </span>
                      <span className="shrink-0 tabular-nums text-spending">{formatKRW(a.amount)}</span>
                    </div>
                    <div className="mt-0.5 flex justify-between gap-3 text-xs text-slate-400 dark:text-slate-500">
                      <span className="min-w-0 truncate">
                        {a.transaction.date.slice(5).replace('-', '/')} · {a.transaction.category}
                      </span>
                      <span className="shrink-0">1건 평소 {formatKRW(a.typicalAmount)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
