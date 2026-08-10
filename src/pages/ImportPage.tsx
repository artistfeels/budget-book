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
    <div className="min-h-screen bg-slate-50 p-8 dark:bg-slate-950">
      <h1 className="mb-6 text-2xl font-bold text-slate-800 dark:text-slate-50">데이터 불러오기</h1>

      <button
        onClick={handleReclassifyAll}
        disabled={reclassifying}
        className="mb-6 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
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
        className="mb-6 block dark:text-slate-300"
      />

      {error && <p className="mb-4 text-rose-600">{error}</p>}

      {parsedRows.length > 0 && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <p className="mb-3 font-medium text-slate-700 dark:text-slate-200">불러올 월 선택 ({parsedRows.length}건 파싱됨)</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {months.map((month) => (
              <label
                key={month}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700 dark:text-slate-200"
              >
                <input
                  type="checkbox"
                  checked={selectedMonths.has(month)}
                  onChange={() => toggleMonth(month)}
                />
                {month}
              </label>
            ))}
          </div>
          <button
            onClick={handleImport}
            className="rounded-lg bg-accent px-5 py-2 font-medium text-white hover:bg-accent-dark"
          >
            선택한 월 불러오기
          </button>
        </div>
      )}

      {summary && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <p className="text-slate-700 dark:text-slate-200">
            신규 {summary.inserted}건, 중복(스킵) {summary.duplicates}건
          </p>
        </div>
      )}

      {parsedRows.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800 dark:text-slate-400">
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
                <tr key={i} className="border-b border-slate-100 text-slate-700 last:border-0 dark:border-slate-800 dark:text-slate-200">
                  <td className="py-1.5 pr-4">{row.date}</td>
                  <td className="py-1.5 pr-4">{row.type}</td>
                  <td className="py-1.5 pr-4">{row.category}</td>
                  <td className="py-1.5 pr-4">{row.content}</td>
                  <td className={`py-1.5 pr-4 ${row.amount < 0 ? 'text-rose-600' : 'text-blue-600'}`}>
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
