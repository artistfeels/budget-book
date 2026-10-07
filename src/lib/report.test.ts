import { describe, it, expect } from 'vitest'
import { buildMonthlyReport } from './report'
import type { Transaction } from '../types/transaction'

let seq = 0
function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: `id-${++seq}`,
    date: '2026-07-06',
    time: '12:00:00',
    type: '지출',
    category: '식비',
    subcategory: '배달',
    content: '테스트',
    amount: -1000,
    currency: 'KRW',
    paymentMethod: '삼성카드',
    memo: null,
    flowType: 'spending',
    flowTypeOverride: null,
    transferPairId: null,
    isPairedTransfer: false,
    isUnmatchedTransfer: false,
    ...overrides,
  }
}

describe('buildMonthlyReport', () => {
  const txs = [
    tx({ date: '2026-06-03', type: '수입', category: '급여', amount: 3_000_000, flowType: 'income' }),
    tx({ date: '2026-06-10', category: '식비', amount: -400_000 }),
    tx({ date: '2026-07-03', type: '수입', category: '급여', amount: 3_000_000, flowType: 'income' }),
    tx({ date: '2026-07-10', category: '식비', amount: -500_000, time: '19:30:00' }),
    tx({ date: '2026-07-05', category: '교통', amount: -100_000 }),
    tx({ date: '2026-07-07', type: '이체', category: '내계좌이체', amount: -1_000_000, flowType: 'neutral' }),
  ]
  const report = buildMonthlyReport(txs, '2026-07')

  it('summarizes the month against the previous month', () => {
    const spending = report.summary.find((r) => r.항목 === '지출')!
    expect(spending).toMatchObject({ 금액: 600_000, 전월: 400_000, 증감: 200_000 })
    expect(report.summary.find((r) => r.항목 === '저축률(%)')!.금액).toBe(80)
  })

  it('breaks spending down by category with share and month-over-month change', () => {
    expect(report.categories[0]).toMatchObject({ 카테고리: '식비', 금액: 500_000, '비중(%)': 83.3, 전월: 400_000, 증감: 100_000 })
    expect(report.categories[1]).toMatchObject({ 카테고리: '교통', 전월: 0 })
  })

  it('lists every transaction of the month in time order, including excluded transfers', () => {
    expect(report.entries.map((e) => e.날짜)).toEqual(['2026-07-03', '2026-07-05', '2026-07-07', '2026-07-10'])
    expect(report.entries[2].분류).toBe('제외')
    expect(report.entries[3].시간).toBe('19:30')
  })
})
