import { formatKRW } from '../../lib/format'
import { resolvedFlowType } from '../../lib/aggregations'
import type { Transaction } from '../../types/transaction'

interface DayTransactionPanelProps {
  date: string
  transactions: Transaction[]
  onClose: () => void
}

const AMOUNT_COLOR_BY_FLOW: Record<ReturnType<typeof resolvedFlowType>, string> = {
  income: 'text-income',
  spending: 'text-spending',
  neutral: 'text-slate-500 dark:text-slate-400',
}

export default function DayTransactionPanel({ date, transactions, onClose }: DayTransactionPanelProps) {
  const dayTransactions = transactions.filter((t) => t.date === date).sort((a, b) => a.time.localeCompare(b.time))

  return (
    <>
      {/* Click-anywhere-to-dismiss scrim. Also dims the page so the panel reads as a layer above
          it rather than a column welded to the edge. */}
      <div
        onClick={onClose}
        className="animate-fade-in fixed inset-0 z-20 bg-black/20 backdrop-blur-[2px] dark:bg-black/50"
        aria-hidden="true"
      />
      <div className="animate-slide-in-right fixed inset-y-0 right-0 z-30 w-full max-w-sm overflow-y-auto border-l border-black/[0.06] bg-surface-light p-6 shadow-2xl dark:border-white/[0.07] dark:bg-surface-dark">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-xl font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">{date}</p>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-all duration-200 ease-spring hover:bg-black/[0.05] hover:text-slate-700 active:scale-90 dark:text-slate-500 dark:hover:bg-white/[0.08] dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>
        {dayTransactions.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">이 날짜에는 거래가 없습니다.</p>
        ) : (
          <ul className="space-y-2.5">
            {dayTransactions.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border border-black/[0.06] p-3.5 text-sm transition-colors duration-150 hover:bg-black/[0.02] dark:border-white/[0.07] dark:hover:bg-white/[0.03]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-800 dark:text-slate-100">{t.content}</span>
                  <span className={`shrink-0 tabular-nums ${AMOUNT_COLOR_BY_FLOW[resolvedFlowType(t)]}`}>
                    {formatKRW(t.amount)}
                  </span>
                </div>
                <div className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                  {t.time.slice(0, 5)} · {t.category} / {t.subcategory} · {t.paymentMethod}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
