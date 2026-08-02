import { describe, it, expect } from 'vitest'
import { categoryBreakdown, categoryMonthHeatmap, paymentMethodBreakdown, subcategoryBreakdown, topMerchants } from './dashboardAggregations'
import type { Transaction } from '../types/transaction'

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'id',
    date: '2026-07-01',
    time: '00:00:00',
    type: '지출',
    category: '식비',
    subcategory: '배달',
    content: '테스트가게',
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

describe('categoryBreakdown', () => {
  it('sums spending amounts per category, largest first', () => {
    const txs = [
      tx({ category: '식비', amount: -10000 }),
      tx({ category: '식비', amount: -5000 }),
      tx({ category: '교통', amount: -30000 }),
    ]
    expect(categoryBreakdown(txs)).toEqual([
      { label: '교통', amount: 30000, count: 1 },
      { label: '식비', amount: 15000, count: 2 },
    ])
  })

  it('excludes non-spending flow types', () => {
    const txs = [
      tx({ category: '급여', amount: 3000000, flowType: 'income', type: '수입' }),
      tx({ category: '내계좌이체', amount: -50000, flowType: 'neutral', type: '이체' }),
    ]
    expect(categoryBreakdown(txs)).toEqual([])
  })

  it('respects a manual flowTypeOverride when bucketing', () => {
    const txs = [tx({ category: '식비', amount: -10000, flowType: 'spending', flowTypeOverride: 'neutral' })]
    expect(categoryBreakdown(txs)).toEqual([])
  })
})

describe('subcategoryBreakdown', () => {
  it('scopes to one category and buckets by subcategory', () => {
    const txs = [
      tx({ category: '식비', subcategory: '배달', amount: -10000 }),
      tx({ category: '식비', subcategory: '한식', amount: -20000 }),
      tx({ category: '교통', subcategory: '택시', amount: -5000 }),
    ]
    expect(subcategoryBreakdown(txs, '식비')).toEqual([
      { label: '한식', amount: 20000, count: 1 },
      { label: '배달', amount: 10000, count: 1 },
    ])
  })
})

describe('topMerchants', () => {
  it('sums by content and limits to the given count, largest first', () => {
    const txs = [
      tx({ content: '가게A', amount: -1000 }),
      tx({ content: '가게A', amount: -2000 }),
      tx({ content: '가게B', amount: -5000 }),
      tx({ content: '가게C', amount: -500 }),
    ]
    expect(topMerchants(txs, 2)).toEqual([
      { label: '가게B', amount: 5000, count: 1 },
      { label: '가게A', amount: 3000, count: 2 },
    ])
  })
})

describe('paymentMethodBreakdown', () => {
  it('sums spending by payment method', () => {
    const txs = [
      tx({ paymentMethod: '삼성카드 taptap O', amount: -10000 }),
      tx({ paymentMethod: '네이버페이 머니', amount: -20000 }),
    ]
    expect(paymentMethodBreakdown(txs)).toEqual([
      { label: '네이버페이 머니', amount: 20000, count: 1 },
      { label: '삼성카드 taptap O', amount: 10000, count: 1 },
    ])
  })
})

describe('categoryMonthHeatmap', () => {
  it('builds a category x month spending matrix, categories sorted by total desc, months asc', () => {
    const txs = [
      tx({ date: '2026-07-05', category: '식비', amount: -10000 }),
      tx({ date: '2026-06-05', category: '식비', amount: -5000 }),
      tx({ date: '2026-07-10', category: '교통', amount: -30000 }),
    ]
    const result = categoryMonthHeatmap(txs)
    expect(result.months).toEqual(['2026-06', '2026-07'])
    expect(result.categories).toEqual(['교통', '식비'])
    expect(result.amounts['교통']).toEqual({ '2026-07': 30000 })
    expect(result.amounts['식비']).toEqual({ '2026-06': 5000, '2026-07': 10000 })
  })

  it('excludes non-spending flow types', () => {
    const txs = [tx({ category: '내계좌이체', amount: -1000, flowType: 'neutral', type: '이체' })]
    const result = categoryMonthHeatmap(txs)
    expect(result.categories).toEqual([])
    expect(result.months).toEqual([])
  })
})
