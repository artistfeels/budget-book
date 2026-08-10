import { formatKRW } from '../../lib/format'
import { resolvedFlowType } from '../../lib/aggregations'
import type { Transaction } from '../../types/transaction'

interface DayTransactionPanelProps {
  date: string
  transactions: Transaction[]
  onClose: () => void
}

const AMOUNT_COLOR_BY_FLOW: Record<ReturnType<typeof resolvedFlowType>, string> = {
  income: 'text-blue-600',
  spending: 'text-rose-600',
  neutral: 'text-slate-500 dark:text-slate-400',
}

export default function DayTransactionPanel({ date, transactions, onClose }: DayTransactionPanelProps) {
  const dayTransactions = transactions.filter((t) => t.date === date).sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className="fixed inset-y-0 right-0 z-20 w-full max-w-sm overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-lg font-bold text-slate-800 dark:text-slate-50">{date}</p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200">
          ✕
        </button>
      </div>
      {dayTransactions.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">이 날짜에는 거래가 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {dayTransactions.map((t) => (
            <li key={t.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700 dark:text-slate-200">{t.content}</span>
                <span className={AMOUNT_COLOR_BY_FLOW[resolvedFlowType(t)]}>{formatKRW(t.amount)}</span>
              </div>
              <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {t.time.slice(0, 5)} · {t.category} / {t.subcategory} · {t.paymentMethod}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
