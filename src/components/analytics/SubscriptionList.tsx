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
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-4 font-medium text-slate-700">구독·정기결제</p>
      {subscriptions.length === 0 ? (
        <p className="text-sm text-slate-400">최근 몇 달간 꾸준히 반복된 결제가 없어요.</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-2">가맹점</th>
                <th className="pb-2 text-right">금액</th>
                <th className="pb-2 text-right">관측 월수</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={`${s.merchant}-${s.amount}`} className="border-b last:border-0">
                  <td className="py-1.5">{s.merchant}</td>
                  <td className="py-1.5 text-right">{formatKRW(s.amount)}</td>
                  <td className="py-1.5 text-right text-slate-400">{s.monthCount}개월</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm font-medium text-slate-700">
            <span>월 구독료 합계</span>
            <span>{formatKRW(total)}</span>
          </div>
        </>
      )}
    </div>
  )
}
