import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { findTargetSheet, parseWorkbook } from './excelParser'

function buildWorkbook(sheetName: string, headers: string[], rows: unknown[][]) {
  const wb = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  XLSX.utils.book_append_sheet(wb, sheet, sheetName)
  return wb
}

describe('findTargetSheet', () => {
  it('prefers the 가계부 내역 sheet name', () => {
    const wb = buildWorkbook('가계부 내역', ['날짜', '시간', '타입', '금액'], [[46222, 0.5, '지출', -1000]])
    expect(findTargetSheet(wb)).toBe('가계부 내역')
  })

  it('falls back to any sheet with the required headers', () => {
    const wb = buildWorkbook('Sheet1', ['날짜', '타입', '대분류', '금액'], [[46222, '지출', '식비', -1000]])
    expect(findTargetSheet(wb)).toBe('Sheet1')
  })

  it('throws when no sheet has the required headers', () => {
    const wb = buildWorkbook('Sheet1', ['A', 'B'], [[1, 2]])
    expect(() => findTargetSheet(wb)).toThrow()
  })
})

describe('parseWorkbook', () => {
  const headers = ['날짜', '시간', '타입', '대분류', '소분류', '내용', '금액', '화폐', '결제수단', '메모']

  it('converts excel date/time serials correctly and maps by header name', () => {
    const wb = buildWorkbook('가계부 내역', headers, [
      [46221, 0.9823611111111111, '이체', '내계좌이체', '미분류', '네이버페이충전', -120000, 'KRW', 'NH주거래우대통장', null],
    ])
    const [row] = parseWorkbook(wb)
    expect(row).toEqual({
      date: '2026-07-18',
      time: '23:34:36',
      type: '이체',
      category: '내계좌이체',
      subcategory: '미분류',
      content: '네이버페이충전',
      amount: -120000,
      currency: 'KRW',
      paymentMethod: 'NH주거래우대통장',
      memo: null,
    })
  })

  it('is unaffected by column reordering', () => {
    const reordered = ['타입', '날짜', '금액', '시간', '대분류', '소분류', '내용', '결제수단', '화폐', '메모']
    const wb = buildWorkbook('가계부 내역', reordered, [
      ['수입', 46200, 37484, 0.25, '금융수입', '미분류', '결산이자', 'OK파킹플렉스통장', 'KRW', null],
    ])
    const [row] = parseWorkbook(wb)
    expect(row.type).toBe('수입')
    expect(row.amount).toBe(37484)
    expect(row.paymentMethod).toBe('OK파킹플렉스통장')
    expect(row.date).toBe('2026-06-27')
  })

  it('defaults missing 소분류 to 미분류 and empty 메모 to null', () => {
    const wb = buildWorkbook('가계부 내역', headers, [
      [46221, 0.5, '지출', '기타', null, '테스트', -100, 'KRW', '토스 간편결제', null],
    ])
    const [row] = parseWorkbook(wb)
    expect(row.subcategory).toBe('미분류')
    expect(row.memo).toBeNull()
  })
})
