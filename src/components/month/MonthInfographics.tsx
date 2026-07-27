import { monthInfographics } from '../../lib/monthDetailAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface MonthInfographicsProps {
  transactions: Transaction[]
  month: string
}

export default function MonthInfographics({ transactions, month }: MonthInfographicsProps) {
  const info = monthInfographics(transactions, month)

  const cards = [
    {
      label: '이번 달 가장 많이 쓴 날',
      value: info.biggestSpendDay ? `${info.biggestSpendDay.date.slice(-2)}일 · ${formatKRW(info.biggestSpendDay.amount)}` : '-',
    },
    { label: '배달', value: `${info.deliveryCount}번 · ${formatKRW(info.deliveryTotal)}` },
    { label: '커피 지출', value: formatKRW(info.coffeeTotal) },
    { label: '하루 평균 지출', value: formatKRW(Math.round(info.dailyAverageSpending)) },
    {
      label: '가장 자주 간 가맹점',
      value: info.mostFrequentMerchant ? `${info.mostFrequentMerchant.content} (${info.mostFrequentMerchant.count}회)` : '-',
    },
    { label: '무지출 데이', value: `${info.noSpendDayCount}일` },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">{card.label}</p>
          <p className="mt-1 text-sm font-bold text-slate-800">{card.value}</p>
        </div>
      ))}
    </div>
  )
}
