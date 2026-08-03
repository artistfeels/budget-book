import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { spendingPaceSeries } from '../../lib/monthDetailAggregations'
import { formatKRW } from '../../lib/format'
import type { Transaction } from '../../types/transaction'

interface SpendingPaceChartProps {
  transactions: Transaction[]
  month: string
}

export default function SpendingPaceChart({ transactions, month }: SpendingPaceChartProps) {
  const [year, monthNum] = month.split('-').map(Number)
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  const now = new Date()
  // Compare against a locally-derived month string, not toISOString() (UTC) — otherwise this
  // mismatches with new Date().getDate() (local) for part of the day around month boundaries.
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const isCurrentMonth = month === currentMonth
  const asOfDay = isCurrentMonth ? now.getDate() : daysInMonth

  const result = useMemo(() => spendingPaceSeries(transactions, month, asOfDay), [transactions, month, asOfDay])
  const clampedAsOfDay = result.asOfDay

  const isFaster = (result.percentVsLastMonthSameDay ?? 0) > 0

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="mb-1 font-medium text-slate-700">지출 속도 (Spending Pace)</p>
      <p className={`mb-4 text-sm font-medium ${isFaster ? 'text-rose-600' : 'text-emerald-600'}`}>
        {result.percentVsLastMonthSameDay === null
          ? '비교할 지난달 데이터가 없습니다.'
          : `지난달 같은 날 대비 ${isFaster ? '+' : ''}${(result.percentVsLastMonthSameDay * 100).toFixed(0)}% ${
              isFaster ? '빠름' : '느림'
            } · 이 속도면 월말 예상 ${formatKRW(Math.round(result.projectedMonthEndTotal))}`}
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={result.points}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v) => formatKRW(v)} tick={{ fontSize: 11 }} width={80} />
          <Tooltip
            formatter={(value: any) => (value === null ? '-' : formatKRW(value))}
            labelFormatter={(day) => `${day}일`}
          />
          <Line type="monotone" dataKey="threeMonthAvg" name="최근 3개월 평균" stroke="#cbd5e1" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="lastMonth" name="지난달" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          <Line type="monotone" dataKey="thisMonth" name="이번 달" stroke="#e11d48" strokeWidth={2.5} dot={false} />
          <Line
            type="monotone"
            dataKey="thisMonthProjected"
            name="이번 달 예상"
            stroke="#e11d48"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-slate-400">{clampedAsOfDay}일까지 실제 데이터, 이후는 현재 속도 기준 예상치입니다.</p>
    </div>
  )
}
