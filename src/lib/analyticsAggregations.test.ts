import { describe, it, expect } from 'vitest'
import { weekdaySpending, hourBucketSpending } from './analyticsAggregations'
import type { Transaction } from '../types/transaction'

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'id',
    date: '2026-07-06', // Monday
    time: '12:00:00',
    type: '지출',
    category: '식비',
    subcategory: '배달',
    content: '테스트',
    amount: -1000,
    currency: 'KRW',
    paymentMethod: '삼성카드 taptap O',
    memo: null,
    flowType: 'spending',
    flowTypeOverride: null,
    transferPairId: null,
    isPairedTransfer: false,
    isUnmatchedTransfer: false,
    ...overrides,
  }
}

describe('weekdaySpending', () => {
  it('buckets spending by weekday, Monday first', () => {
    const txs = [
      tx({ date: '2026-07-06', amount: -10000 }), // Mon
      tx({ date: '2026-07-07', amount: -5000 }), // Tue
      tx({ date: '2026-07-12', amount: -3000 }), // Sun
    ]
    const result = weekdaySpending(txs)
    expect(result).toEqual([
      { weekday: '월', amount: 10000 },
      { weekday: '화', amount: 5000 },
      { weekday: '수', amount: 0 },
      { weekday: '목', amount: 0 },
      { weekday: '금', amount: 0 },
      { weekday: '토', amount: 0 },
      { weekday: '일', amount: 3000 },
    ])
  })

  it('excludes non-spending flow types', () => {
    const txs = [tx({ date: '2026-07-06', amount: 3000000, flowType: 'income', type: '수입' })]
    expect(weekdaySpending(txs).every((w) => w.amount === 0)).toBe(true)
  })

  it('nets refunds against the same weekday and clamps at 0', () => {
    const txs = [
      tx({ date: '2026-07-06', amount: -10000 }),
      tx({ date: '2026-07-06', amount: 15000 }), // over-refund, same Monday
    ]
    const result = weekdaySpending(txs)
    expect(result.find((w) => w.weekday === '월')?.amount).toBe(0)
  })

  it('returns all 7 weekdays with 0 for an empty dataset', () => {
    expect(weekdaySpending([])).toHaveLength(7)
    expect(weekdaySpending([]).every((w) => w.amount === 0)).toBe(true)
  })
})

describe('hourBucketSpending', () => {
  it('buckets spending into 새벽/오전/오후/저녁/심야 by hour', () => {
    const txs = [
      tx({ time: '03:00:00', amount: -1000 }), // 새벽
      tx({ time: '09:00:00', amount: -2000 }), // 오전
      tx({ time: '15:00:00', amount: -3000 }), // 오후
      tx({ time: '19:00:00', amount: -4000 }), // 저녁
      tx({ time: '23:30:00', amount: -5000 }), // 심야
    ]
    expect(hourBucketSpending(txs)).toEqual([
      { bucket: '새벽', amount: 1000 },
      { bucket: '오전', amount: 2000 },
      { bucket: '오후', amount: 3000 },
      { bucket: '저녁', amount: 4000 },
      { bucket: '심야', amount: 5000 },
    ])
  })

  it('treats hour boundaries correctly (06:00 is 오전, not 새벽; 22:00 is 심야, not 저녁)', () => {
    const txs = [
      tx({ time: '06:00:00', amount: -1000 }),
      tx({ time: '22:00:00', amount: -2000 }),
    ]
    const result = hourBucketSpending(txs)
    expect(result.find((h) => h.bucket === '오전')?.amount).toBe(1000)
    expect(result.find((h) => h.bucket === '새벽')?.amount).toBe(0)
    expect(result.find((h) => h.bucket === '심야')?.amount).toBe(2000)
    expect(result.find((h) => h.bucket === '저녁')?.amount).toBe(0)
  })

  it('returns all 5 buckets with 0 for an empty dataset', () => {
    expect(hourBucketSpending([])).toHaveLength(5)
    expect(hourBucketSpending([]).every((h) => h.amount === 0)).toBe(true)
  })
})
