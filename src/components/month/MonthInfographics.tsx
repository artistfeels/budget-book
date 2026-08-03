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
      icon: '🔥',
      label: '이번 달 가장 많이 쓴 날',
      value: info.biggestSpendDay ? `${info.biggestSpendDay.date.slice(-2)}일` : '-',
      sub: info.biggestSpendDay ? formatKRW(info.biggestSpendDay.amount) : undefined,
      accent: 'text-rose-600',
    },
    { icon: '🛵', label: '배달', value: formatKRW(info.deliveryTotal), sub: `${info.deliveryCount}번`, accent: 'text-orange-600' },
    { icon: '☕', label: '커피 지출', value: formatKRW(info.coffeeTotal), accent: 'text-amber-700' },
    {
      icon: '📊',
      label: '하루 평균 지출',
      value: formatKRW(Math.round(info.dailyAverageSpending)),
      accent: 'text-slate-800',
    },
    {
      icon: '🏪',
      label: '가장 자주 간 가맹점',
      value: info.mostFrequentMerchant ? info.mostFrequentMerchant.content : '-',
      sub: info.mostFrequentMerchant ? `${info.mostFrequentMerchant.count}회 방문` : undefined,
      accent: 'text-blue-600',
    },
    { icon: '💤', label: '무지출 데이', value: `${info.noSpendDayCount}일`, accent: 'text-emerald-600' },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xl">{card.icon}</span>
            <p className="text-xs font-medium text-slate-500">{card.label}</p>
          </div>
          <p className={`text-2xl font-bold leading-tight ${card.accent}`}>{card.value}</p>
          {card.sub && <p className="mt-1 text-sm text-slate-400">{card.sub}</p>}
        </div>
      ))}
    </div>
  )
}
