import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CalendarGrid from '../components/month/CalendarGrid'
import DayTransactionPanel from '../components/month/DayTransactionPanel'
import SpendingPaceChart from '../components/month/SpendingPaceChart'
import { useTransactionStore } from '../store/useTransactionStore'
import { listAvailableMonths } from '../lib/aggregations'

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function MonthDetailPage() {
  const { yyyyMm } = useParams<{ yyyyMm: string }>()
  const navigate = useNavigate()
  const transactions = useTransactionStore((s) => s.transactions)
  const availableMonths = useMemo(() => listAvailableMonths(transactions), [transactions])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const month = yyyyMm ?? availableMonths[availableMonths.length - 1] ?? new Date().toISOString().slice(0, 7)

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate(`/month/${shiftMonth(month, -1)}`)} className="rounded-lg bg-white px-3 py-1.5 text-slate-600 shadow-sm">
          ← 이전 달
        </button>
        <select value={month} onChange={(e) => navigate(`/month/${e.target.value}`)} className="rounded-lg border px-3 py-1.5 text-lg font-bold text-slate-800">
          {availableMonths.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button onClick={() => navigate(`/month/${shiftMonth(month, 1)}`)} className="rounded-lg bg-white px-3 py-1.5 text-slate-600 shadow-sm">
          다음 달 →
        </button>
      </div>

      <CalendarGrid transactions={transactions} month={month} onDayClick={setSelectedDay} />

      <div className="mt-6">
        <SpendingPaceChart transactions={transactions} month={month} />
      </div>

      {selectedDay && (
        <DayTransactionPanel date={selectedDay} transactions={transactions} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  )
}
