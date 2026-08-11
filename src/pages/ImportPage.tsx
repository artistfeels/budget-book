import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { parseWorkbook, type ParsedRawRow } from '../lib/excelParser'
import { useTransactionStore } from '../store/useTransactionStore'
import { formatKRW } from '../lib/format'

export default function ImportPage() {
  const [parsedRows, setParsedRows] = useState<ParsedRawRow[]>([])
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set())
  const [summary, setSummary] = useState<{ inserted: number; duplicates: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const importRows = useTransactionStore((s) => s.importRows)

  const [reclassifying, setReclassifying] = useState(false)

  async function handleReclassifyAll() {
    setReclassifying(true)
    setError(null)
    try {
      await importRows([])
      setSummary(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setReclassifying(false)
    }
  }

  const months = useMemo(() => {
    const set = new Set(parsedRows.map((r) => r.date.slice(0, 7)))
    return [...set].sort()
  }, [parsedRows])

  async function handleFile(file: File) {
    setError(null)
    setSummary(null)
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const rows = parseWorkbook(workbook)
      setParsedRows(rows)
      setSelectedMonths(new Set(rows.map((r) => r.date.slice(0, 7))))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function toggleMonth(month: string) {
    setSelectedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(month)) next.delete(month)
      else next.add(month)
      return next
    })
  }

  async function handleImport() {
    const rowsToImport = parsedRows.filter((r) => selectedMonths.has(r.date.slice(0, 7)))
    const result = await importRows(rowsToImport)
    setSummary(result)
  }

  return (
    <div>
      <h1 className="page-title animate-fade-up mb-6 md:mb-8">데이터 불러오기</h1>

      <button
        onClick={handleReclassifyAll}
        disabled={reclassifying}
        className="animate-fade-up stagger-1 mb-6 rounded-full border border-black/[0.08] px-4 py-2 text-sm font-medium text-slate-600 transition-all duration-200 ease-spring hover:bg-black/[0.04] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 dark:border-white/[0.1] dark:text-slate-300 dark:hover:bg-white/[0.06]"
      >
        {reclassifying ? '재분류 중…' : '전체 재분류 (분류 알고리즘이 바뀐 뒤 파일 없이 다시 계산)'}
      </button>

      <input
        type="file"
        accept=".xlsx"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
        className="animate-fade-up stagger-2 mb-6 block text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-accent-dark dark:text-slate-300 dark:file:bg-accent-light"
      />

      {error && (
        <p className="animate-scale-in mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400">
          {error}
        </p>
      )}

      {parsedRows.length > 0 && (
        <div className="card animate-fade-up mb-6 p-4 md:p-6">
          <p className="card-title mb-4">불러올 월 선택 ({parsedRows.length}건 파싱됨)</p>
          <div className="mb-5 flex flex-wrap gap-2">
            {months.map((month) => (
              <label
                key={month}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-all duration-200 ease-spring ${
                  selectedMonths.has(month)
                    ? 'border-accent/40 bg-accent/10 text-accent dark:border-accent-light/40 dark:bg-accent-light/10 dark:text-accent-light'
                    : 'border-black/[0.08] text-slate-500 hover:bg-black/[0.03] dark:border-white/[0.1] dark:text-slate-400 dark:hover:bg-white/[0.05]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedMonths.has(month)}
                  onChange={() => toggleMonth(month)}
                  className="accent-accent"
                />
                {month}
              </label>
            ))}
          </div>
          <button onClick={handleImport} className="btn-primary">
            선택한 월 불러오기
          </button>
        </div>
      )}

      {summary && (
        <div className="card animate-fade-up p-4 md:p-6">
          <p className="text-slate-700 dark:text-slate-200">
            신규 {summary.inserted}건, 중복(스킵) {summary.duplicates}건
          </p>
        </div>
      )}

      {parsedRows.length > 0 && (
        <div className="card animate-fade-up mt-6 overflow-x-auto p-4 md:p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-slate-500 dark:border-white/[0.07] dark:text-slate-400">
                <th className="pb-2 pr-4">날짜</th>
                <th className="pb-2 pr-4">타입</th>
                <th className="pb-2 pr-4">대분류</th>
                <th className="pb-2 pr-4">내용</th>
                <th className="pb-2 pr-4">금액</th>
                <th className="pb-2">결제수단</th>
              </tr>
            </thead>
            <tbody>
              {parsedRows.slice(0, 50).map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-black/[0.04] text-slate-700 last:border-0 dark:border-white/[0.05] dark:text-slate-200"
                >
                  <td className="py-1.5 pr-4">{row.date}</td>
                  <td className="py-1.5 pr-4">{row.type}</td>
                  <td className="py-1.5 pr-4">{row.category}</td>
                  <td className="py-1.5 pr-4">{row.content}</td>
                  <td className={`py-1.5 pr-4 tabular-nums ${row.amount < 0 ? 'text-spending' : 'text-income'}`}>
                    {formatKRW(row.amount)}
                  </td>
                  <td className="py-1.5">{row.paymentMethod}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {parsedRows.length > 50 && (
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">처음 50건만 미리보기로 표시됩니다.</p>
          )}
        </div>
      )}
    </div>
  )
}
