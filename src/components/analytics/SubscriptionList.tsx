import { detectSubscriptions } from '../../lib/analyticsAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface SubscriptionListProps {
  transactions: Transaction[]
}

export default function SubscriptionList({ transactions }: SubscriptionListProps) {
  const subscriptions = detectSubscriptions(transactions)
  const total = subscriptions.reduce((sum, s) => sum + s.amount, 0)

  return (
    <div className="card animate-fade-up p-4 md:p-6">
      <p className="card-title mb-5">구독·정기결제</p>
      {subscriptions.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">최근 몇 달간 꾸준히 반복된 결제가 없어요.</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-slate-500 dark:border-white/[0.07] dark:text-slate-400">
                <th className="pb-2">가맹점</th>
                <th className="pb-2 text-right">금액</th>
                <th className="pb-2 text-right">관측 월수</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr
                  key={`${s.merchant}-${s.amount}`}
                  className="border-b border-black/[0.04] text-slate-700 transition-colors duration-150 last:border-0 hover:bg-black/[0.02] dark:border-white/[0.05] dark:text-slate-200 dark:hover:bg-white/[0.03]"
                >
                  <td className="py-2">{s.merchant}</td>
                  <td className="py-2 text-right tabular-nums">{formatKRW(s.amount)}</td>
                  <td className="py-2 text-right tabular-nums text-slate-400 dark:text-slate-500">
                    {s.monthCount}개월
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex items-baseline justify-between border-t border-black/[0.06] pt-4 dark:border-white/[0.07]">
            <span className="text-sm text-slate-500 dark:text-slate-400">월 구독료 합계</span>
            <span className="text-lg font-semibold tabular-nums tracking-[-0.02em] text-slate-900 dark:text-white">
              {formatKRW(total)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
