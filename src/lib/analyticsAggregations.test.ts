import { describe, it, expect } from 'vitest'
import { weekdaySpending, hourBucketSpending, detectSubscriptions, categoryTrendRanking } from './analyticsAggregations'
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

describe('detectSubscriptions', () => {
  it('detects a recurring merchant+amount pair present in the latest two months', () => {
    const txs = [
      tx({ date: '2026-06-01', content: '넷플릭스', amount: -17000 }),
      tx({ date: '2026-07-01', content: '넷플릭스', amount: -17000 }),
    ]
    expect(detectSubscriptions(txs)).toEqual([{ merchant: '넷플릭스', amount: 17000, monthCount: 2 }])
  })

  it('counts every distinct month the pair appears in, not just the latest two', () => {
    const txs = [
      tx({ date: '2026-05-01', content: '넷플릭스', amount: -17000 }),
      tx({ date: '2026-06-01', content: '넷플릭스', amount: -17000 }),
      tx({ date: '2026-07-01', content: '넷플릭스', amount: -17000 }),
    ]
    expect(detectSubscriptions(txs)).toEqual([{ merchant: '넷플릭스', amount: 17000, monthCount: 3 }])
  })

  it('excludes a one-off purchase that only appears in the latest month', () => {
    const txs = [
      tx({ date: '2026-06-01', content: '넷플릭스', amount: -17000 }),
      tx({ date: '2026-07-01', content: '넷플릭스', amount: -17000 }),
      tx({ date: '2026-07-15', content: '가전제품', amount: -500000 }),
    ]
    expect(detectSubscriptions(txs)).toEqual([{ merchant: '넷플릭스', amount: 17000, monthCount: 2 }])
  })

  it('excludes a lapsed subscription that stopped before the latest month', () => {
    const txs = [
      tx({ date: '2026-05-01', content: '왓챠', amount: -12900 }),
      tx({ date: '2026-06-01', content: '왓챠', amount: -12900 }),
      tx({ date: '2026-07-01', content: '넷플릭스', amount: -17000 }), // unrelated tx to establish July as latest
    ]
    expect(detectSubscriptions(txs)).toEqual([])
  })

  it('returns an empty array when fewer than 2 distinct months of data exist', () => {
    const txs = [tx({ date: '2026-07-01', content: '넷플릭스', amount: -17000 })]
    expect(detectSubscriptions(txs)).toEqual([])
  })

  it('treats a different amount at the same merchant as a different subscription candidate', () => {
    const txs = [
      tx({ date: '2026-06-01', content: '통신비', amount: -50000 }),
      tx({ date: '2026-07-01', content: '통신비', amount: -55000 }), // price changed — no 2-month match either way
    ]
    expect(detectSubscriptions(txs)).toEqual([])
  })

  it('sorts multiple detected subscriptions by amount descending', () => {
    const txs = [
      tx({ date: '2026-06-01', content: '유튜브 프리미엄', amount: -14900 }),
      tx({ date: '2026-07-01', content: '유튜브 프리미엄', amount: -14900 }),
      tx({ date: '2026-06-01', content: '넷플릭스', amount: -17000 }),
      tx({ date: '2026-07-01', content: '넷플릭스', amount: -17000 }),
    ]
    expect(detectSubscriptions(txs).map((s) => s.merchant)).toEqual(['넷플릭스', '유튜브 프리미엄'])
  })
})

describe('categoryTrendRanking', () => {
  it('computes changeAmount against the average of prior months that actually have data', () => {
    const txs = [
      tx({ date: '2026-07-10', category: '식비', amount: -50000 }),
      tx({ date: '2026-06-10', category: '식비', amount: -30000 }),
      tx({ date: '2026-05-10', category: '식비', amount: -40000 }),
      // no 식비 data in 2026-04 — average should be over the 2 months that exist, not 3
    ]
    const result = categoryTrendRanking(txs, '2026-07')
    expect(result).toEqual([{ category: '식비', currentAmount: 50000, baselineAmount: 35000, changeAmount: 15000 }])
  })

  it('excludes a category with no data at all in the 3 prior months', () => {
    const txs = [tx({ date: '2026-07-10', category: '신규카테고리', amount: -10000 })]
    expect(categoryTrendRanking(txs, '2026-07')).toEqual([])
  })

  it('includes a category with baseline data even if the current month has none (changeAmount negative)', () => {
    const txs = [tx({ date: '2026-06-10', category: '여행/숙박', amount: -300000 })]
    const result = categoryTrendRanking(txs, '2026-07')
    expect(result).toEqual([
      { category: '여행/숙박', currentAmount: 0, baselineAmount: 300000, changeAmount: -300000 },
    ])
  })

  it('sorts by changeAmount descending (biggest increase first, biggest decrease last)', () => {
    const txs = [
      tx({ date: '2026-07-10', category: '교통', amount: -20000 }),
      tx({ date: '2026-06-10', category: '교통', amount: -10000 }), // +10000
      tx({ date: '2026-07-10', category: '문화/여가', amount: -5000 }),
      tx({ date: '2026-06-10', category: '문화/여가', amount: -50000 }), // -45000
    ]
    const result = categoryTrendRanking(txs, '2026-07')
    expect(result.map((r) => r.category)).toEqual(['교통', '문화/여가'])
  })

  it('excludes non-spending flow types from both current and baseline calculations', () => {
    const txs = [
      tx({ date: '2026-07-10', category: '급여', amount: 3000000, flowType: 'income', type: '수입' }),
      tx({ date: '2026-06-10', category: '급여', amount: 3000000, flowType: 'income', type: '수입' }),
    ]
    expect(categoryTrendRanking(txs, '2026-07')).toEqual([])
  })
})
