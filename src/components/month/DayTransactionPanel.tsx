import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface DayTransactionPanelProps {
  date: string
  transactions: Transaction[]
  onClose: () => void
}

export default function DayTransactionPanel({ date, transactions, onClose }: DayTransactionPanelProps) {
  const dayTransactions = transactions.filter((t) => t.date === date).sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className="fixed inset-y-0 right-0 z-20 w-full max-w-sm overflow-y-auto bg-white p-6 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-lg font-bold text-slate-800">{date}</p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
          ✕
        </button>
      </div>
      {dayTransactions.length === 0 ? (
        <p className="text-sm text-slate-400">이 날짜에는 거래가 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {dayTransactions.map((t) => (
            <li key={t.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">{t.content}</span>
                <span className={t.amount < 0 ? 'text-rose-600' : 'text-blue-600'}>{formatKRW(t.amount)}</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {t.time.slice(0, 5)} · {t.category} / {t.subcategory} · {t.paymentMethod}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
