import * as XLSX from 'xlsx'
import type { TransactionType } from '../types/transaction'

export interface ParsedRawRow {
  date: string
  time: string
  type: TransactionType
  category: string
  subcategory: string
  content: string
  amount: number
  currency: string
  paymentMethod: string
  memo: string | null
}

const PREFERRED_SHEET_NAME = '가계부 내역'
const REQUIRED_HEADERS = ['날짜', '타입', '금액']

export function findTargetSheet(workbook: XLSX.WorkBook): string {
  if (workbook.SheetNames.includes(PREFERRED_SHEET_NAME)) {
    return PREFERRED_SHEET_NAME
  }
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
    const header = (rows[0] ?? []) as string[]
    if (REQUIRED_HEADERS.every((h) => header.includes(h))) {
      return name
    }
  }
  throw new Error('가계부 데이터가 있는 시트를 찾을 수 없습니다 (날짜/타입/금액 헤더 필요).')
}

// Excel serial-date epoch is 1899-12-30 (accounts for the Lotus 1-2-3 leap-year bug).
// Do NOT use XLSX's `cellDates: true` — verified during design to shift the calendar
// date by applying a timezone offset. Convert the raw serial manually instead.
function excelSerialToDateString(serial: number): string {
  const wholeDays = Math.round(serial)
  const utcMs = Date.UTC(1899, 11, 30) + wholeDays * 86400000
  const d = new Date(utcMs)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function excelFractionToTimeString(frac: number): string {
  const totalSeconds = Math.round(frac * 86400)
  const hh = String(Math.floor(totalSeconds / 3600) % 24).padStart(2, '0')
  const mm = String(Math.floor(totalSeconds / 60) % 60).padStart(2, '0')
  const ss = String(totalSeconds % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function parseWorkbook(workbook: XLSX.WorkBook): ParsedRawRow[] {
  const sheetName = findTargetSheet(workbook)
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })

  return rows.map((row) => ({
    date: excelSerialToDateString(Number(row['날짜'])),
    time: excelFractionToTimeString(Number(row['시간'] ?? 0)),
    type: row['타입'] as TransactionType,
    category: String(row['대분류'] ?? '미분류'),
    subcategory: row['소분류'] ? String(row['소분류']) : '미분류',
    content: String(row['내용'] ?? ''),
    amount: Number(row['금액']),
    currency: String(row['화폐'] ?? 'KRW'),
    paymentMethod: String(row['결제수단'] ?? ''),
    memo: row['메모'] ? String(row['메모']) : null,
  }))
}
