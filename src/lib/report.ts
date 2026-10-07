import type { Transaction } from '../types/transaction'
import { resolvedFlowType, summarizeByMonth } from './aggregations'
import { categoryBreakdown } from './dashboardAggregations'
import { detectCategoryAnomalies, detectLargeTransactions } from './anomalies'
import { shiftMonth } from './month'

// 월간 리포트를 엑셀 시트로 옮기기 위한 행 데이터. 키 이름이 그대로 엑셀 헤더가 된다.
// xlsx 의존 없이 순수 데이터만 만들어 테스트할 수 있게 분리했다 (파일 생성은 exportMonthlyReport).

type Row = Record<string, string | number>

export interface MonthlyReport {
  month: string
  summary: Row[]
  categories: Row[]
  anomalies: Row[]
  entries: Row[]
}

const FLOW_LABEL = { income: '수입', spending: '지출', neutral: '제외' } as const

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0
}

export function buildMonthlyReport(transactions: Transaction[], month: string): MonthlyReport {
  const prevMonth = shiftMonth(month, -1)
  const summaries = summarizeByMonth(transactions)
  const cur = summaries.find((s) => s.month === month) ?? { income: 0, spending: 0, saving: 0, netCashFlow: 0 }
  const prev = summaries.find((s) => s.month === prevMonth)

  const summary: Row[] = [
    { 항목: '수입', 금액: cur.income, 전월: prev?.income ?? 0, 증감: cur.income - (prev?.income ?? 0) },
    { 항목: '지출', 금액: cur.spending, 전월: prev?.spending ?? 0, 증감: cur.spending - (prev?.spending ?? 0) },
    { 항목: '저축(수입-지출)', 금액: cur.saving, 전월: prev?.saving ?? 0, 증감: cur.saving - (prev?.saving ?? 0) },
    { 항목: '순현금흐름', 금액: cur.netCashFlow, 전월: prev?.netCashFlow ?? 0, 증감: cur.netCashFlow - (prev?.netCashFlow ?? 0) },
    { 항목: '저축률(%)', 금액: pct(cur.saving, cur.income), 전월: prev ? pct(prev.saving, prev.income) : 0, 증감: '' },
  ]

  const inMonth = (m: string) => transactions.filter((t) => t.date.slice(0, 7) === m)
  const monthTx = inMonth(month)
  const prevByCategory = new Map(categoryBreakdown(inMonth(prevMonth)).map((c) => [c.label, c.amount]))
  const categories: Row[] = categoryBreakdown(monthTx).map((c) => {
    const before = prevByCategory.get(c.label) ?? 0
    return {
      카테고리: c.label,
      금액: c.amount,
      '비중(%)': pct(c.amount, cur.spending),
      건수: c.count,
      전월: before,
      증감: c.amount - before,
    }
  })

  const anomalies: Row[] = [
    ...detectCategoryAnomalies(transactions, month).map((a) => ({
      구분: '카테고리',
      내용: a.category,
      금액: a.currentAmount,
      평소: a.typicalAmount,
      배수: a.ratio === null ? '' : Math.round(a.ratio * 10) / 10,
    })),
    ...detectLargeTransactions(transactions, month).map((a) => ({
      구분: '큰 결제',
      내용: `${a.transaction.date} ${a.transaction.content} (${a.transaction.category})`,
      금액: a.amount,
      평소: a.typicalAmount,
      배수: Math.round(a.ratio * 10) / 10,
    })),
  ]

  const entries: Row[] = [...monthTx]
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .map((t) => ({
      날짜: t.date,
      시간: t.time.slice(0, 5),
      타입: t.type,
      분류: FLOW_LABEL[resolvedFlowType(t)],
      대분류: t.category,
      소분류: t.subcategory,
      내용: t.content,
      금액: t.amount,
      결제수단: t.paymentMethod,
      메모: t.memo ?? '',
    }))

  return { month, summary, categories, anomalies, entries }
}

/** 브라우저에서 .xlsx 파일로 내려받는다. xlsx는 이 버튼을 누를 때만 불러온다. */
export async function exportMonthlyReport(transactions: Transaction[], month: string): Promise<void> {
  const XLSX = await import('xlsx')
  const report = buildMonthlyReport(transactions, month)
  const wb = XLSX.utils.book_new()
  const sheet = (rows: Row[], empty: string) => XLSX.utils.json_to_sheet(rows.length ? rows : [{ 안내: empty }])
  XLSX.utils.book_append_sheet(wb, sheet(report.summary, '데이터 없음'), '요약')
  XLSX.utils.book_append_sheet(wb, sheet(report.categories, '이번 달 지출 없음'), '카테고리별 지출')
  XLSX.utils.book_append_sheet(wb, sheet(report.anomalies, '평소와 크게 다른 지출 없음'), '이상 지출')
  XLSX.utils.book_append_sheet(wb, sheet(report.entries, '거래 없음'), '거래 내역')
  XLSX.writeFile(wb, `가계부-리포트-${month}.xlsx`)
}
