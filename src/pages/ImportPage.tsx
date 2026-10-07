import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { parseWorkbook, type ParsedRawRow } from '../lib/excelParser'
import { useTransactionStore } from '../store/useTransactionStore'
import { formatKRW } from '../lib/format'
import { formatMonthLabel } from '../lib/month'

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

interface ImportResult {
  inserted: number
  duplicates: number
  /** Latest month in this import — where the "see it" link goes. */
  latestMonth: string
}

export default function ImportPage() {
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRawRow[]>([])
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [reclassifying, setReclassifying] = useState(false)
  const [reclassified, setReclassified] = useState(false)
  const importRows = useTransactionStore((s) => s.importRows)

  const months = useMemo(() => {
    const set = new Set(parsedRows.map((r) => r.date.slice(0, 7)))
    return [...set].sort()
  }, [parsedRows])

  const selectedCount = useMemo(
    () => parsedRows.filter((r) => selectedMonths.has(r.date.slice(0, 7))).length,
    [parsedRows, selectedMonths]
  )

  async function handleFile(file: File) {
    setError(null)
    setResult(null)
    setFileName(file.name)
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const rows = parseWorkbook(workbook)
      setParsedRows(rows)
      setSelectedMonths(new Set(rows.map((r) => r.date.slice(0, 7))))
    } catch (e) {
      setParsedRows([])
      setError(`파일을 읽지 못했어요. 뱅크샐러드에서 내보낸 .xlsx 파일이 맞는지 확인해주세요. (${errorText(e)})`)
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
    setImporting(true)
    setError(null)
    try {
      const { inserted, duplicates } = await importRows(rowsToImport)
      setResult({ inserted, duplicates, latestMonth: [...selectedMonths].sort().pop() ?? '' })
    } catch (e) {
      setError(`저장하지 못했어요. 잠시 후 다시 시도해주세요. (${errorText(e)})`)
    } finally {
      setImporting(false)
    }
  }

  async function handleReclassifyAll() {
    if (!window.confirm('저장된 모든 거래의 분류(수입·지출·이체)를 다시 계산할까요? 직접 바꾼 분류는 그대로 유지됩니다.')) {
      return
    }
    setReclassifying(true)
    setReclassified(false)
    setError(null)
    try {
      await importRows([])
      setReclassified(true)
    } catch (e) {
      setError(`재분류하지 못했어요. (${errorText(e)})`)
    } finally {
      setReclassifying(false)
    }
  }

  return (
    <div>
      <h1 className="page-title animate-fade-up mb-6 md:mb-8">데이터 불러오기</h1>

      <input
        id="import-file"
        type="file"
        accept=".xlsx"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = '' // lets the same file be picked again after fixing it
        }}
        className="peer sr-only"
      />
      <label
        htmlFor="import-file"
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        className={`card animate-fade-up stagger-1 mb-6 flex cursor-pointer flex-col items-center gap-3 border-2 border-dashed px-6 py-10 text-center peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent md:py-14 ${
          dragging
            ? 'border-accent bg-amber-50 dark:border-accent-light dark:bg-amber-400/[0.06]'
            : 'border-black/[0.1] hover:border-accent/50 dark:border-white/[0.12] dark:hover:border-accent-light/50'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-9 w-9 text-accent dark:text-accent-light"
          aria-hidden="true"
        >
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M9 13h6M9 17h6M9 9h1" />
        </svg>
        <span className="text-base font-semibold text-slate-900 dark:text-white">
          {fileName ?? '뱅크샐러드 엑셀 파일 선택'}
        </span>
        <span className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          {fileName
            ? '다른 파일을 쓰려면 다시 누르거나 끌어다 놓으세요.'
            : '뱅크샐러드에서 내보낸 .xlsx 파일을 끌어다 놓거나 눌러서 고르세요. 이미 저장된 거래는 자동으로 건너뜁니다.'}
        </span>
      </label>

      {error && (
        <p
          role="alert"
          className="animate-scale-in mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
        >
          {error}
        </p>
      )}

      {result && (
        <div role="status" className="card animate-scale-in mb-6 flex flex-wrap items-center justify-between gap-4 p-4 md:p-6">
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">새 거래 {result.inserted}건을 저장했어요</p>
            {result.duplicates > 0 && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                이미 있던 {result.duplicates}건은 건너뛰었어요.
              </p>
            )}
          </div>
          {result.latestMonth && (
            <Link to={`/monthly/${result.latestMonth}`} className="btn-primary">
              {formatMonthLabel(result.latestMonth)} 보기
            </Link>
          )}
        </div>
      )}

      {parsedRows.length > 0 && (
        <div className="card animate-fade-up mb-6 p-4 md:p-6">
          <p className="card-title mb-1">불러올 달을 고르세요</p>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            파일에서 {parsedRows.length.toLocaleString('ko-KR')}건을 읽었어요.
          </p>
          <div className="mb-5 flex flex-wrap gap-2">
            {months.map((month) => (
              <label
                key={month}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm transition-all duration-[250ms] ease-spring has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent md:min-h-0 md:py-1.5 ${
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
                {formatMonthLabel(month)}
              </label>
            ))}
          </div>
          <button onClick={handleImport} disabled={importing || selectedCount === 0} className="btn-primary">
            {importing ? '저장하는 중…' : `${selectedCount.toLocaleString('ko-KR')}건 불러오기`}
          </button>
        </div>
      )}

      {parsedRows.length > 0 && (
        <div className="card animate-fade-up overflow-x-auto p-4 md:p-6">
          <p className="card-title mb-4">미리보기</p>
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
                  <td className="whitespace-nowrap py-1.5 pr-4">{row.date}</td>
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
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">처음 50건만 보여드려요.</p>
          )}
        </div>
      )}

      {/* Maintenance, not part of the everyday import — kept out of the way and behind a confirm. */}
      <details className="group mt-10 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer select-none items-center gap-1.5 font-medium text-slate-500 hover:text-slate-800 md:min-h-0 dark:text-slate-400 dark:hover:text-slate-100">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="h-3.5 w-3.5 transition-transform duration-[250ms] group-open:rotate-90"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
          고급
        </summary>
        <div className="mt-3 max-w-xl space-y-3 text-slate-500 dark:text-slate-400">
          <p>
            분류 규칙이 바뀐 뒤 이미 저장된 거래를 새 규칙으로 다시 분류합니다. 파일은 필요 없고, 직접 바꾼 분류는 그대로
            남아요.
          </p>
          <button
            onClick={handleReclassifyAll}
            disabled={reclassifying}
            className="btn-ghost border border-black/[0.08] disabled:pointer-events-none disabled:opacity-40 dark:border-white/[0.1]"
          >
            {reclassifying ? '다시 분류하는 중…' : '전체 다시 분류'}
          </button>
          {reclassified && <p role="status">다시 분류했어요.</p>}
        </div>
      </details>
    </div>
  )
}
