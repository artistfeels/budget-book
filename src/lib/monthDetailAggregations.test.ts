import { describe, it, expect } from 'vitest'
import { dailySummaries, monthInfographics, spendingPaceSeries, weeklySpendingBands } from './monthDetailAggregations'
import type { Transaction } from '../types/transaction'

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'id',
    date: '2026-07-01',
    time: '00:00:00',
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

describe('dailySummaries', () => {
  it('produces one entry per calendar day in the month, zero-filled where no transactions exist', () => {
    const txs = [tx({ date: '2026-06-05', amount: -10000 })]
    const result = dailySummaries(txs, '2026-06')
    expect(result).toHaveLength(30)
    expect(result[0]).toEqual({ date: '2026-06-01', income: 0, spending: 0 })
    expect(result[4]).toEqual({ date: '2026-06-05', income: 0, spending: 10000 })
  })

  it('sums income and spending separately using resolvedFlowType', () => {
    const txs = [
      tx({ date: '2026-06-10', amount: 3000000, flowType: 'income', type: '수입' }),
      tx({ date: '2026-06-10', amount: -20000, flowType: 'spending' }),
      tx({ date: '2026-06-10', amount: -5000, flowType: 'neutral', type: '이체' }),
    ]
    const result = dailySummaries(txs, '2026-06')
    expect(result[9]).toEqual({ date: '2026-06-10', income: 3000000, spending: 20000 })
  })

  it('ignores transactions outside the requested month', () => {
    const txs = [tx({ date: '2026-07-01', amount: -10000 })]
    const result = dailySummaries(txs, '2026-06')
    expect(result.every((d) => d.spending === 0)).toBe(true)
  })
})

describe('weeklySpendingBands', () => {
  it('splits a month starting on Monday into full weeks plus one partial trailing week', () => {
    // 2026-06-01 is a Monday, 2026-06-30 is a Tuesday (30 days total)
    const txs = [tx({ date: '2026-06-01', amount: -7000 }), tx({ date: '2026-06-29', amount: -3000 })]
    const bands = weeklySpendingBands(txs, '2026-06')
    expect(bands).toHaveLength(5)
    expect(bands[0]).toEqual({ weekIndex: 0, startDate: '2026-06-01', endDate: '2026-06-07', total: 7000, isPartial: false })
    expect(bands[4]).toEqual({ weekIndex: 4, startDate: '2026-06-29', endDate: '2026-06-30', total: 3000, isPartial: true })
  })

  it('starts with a partial week when the month does not begin on a Monday', () => {
    // 2026-07-01 is a Wednesday, 2026-07-31 is a Friday (31 days total)
    const txs: Transaction[] = []
    const bands = weeklySpendingBands(txs, '2026-07')
    expect(bands).toHaveLength(5)
    expect(bands[0]).toEqual({ weekIndex: 0, startDate: '2026-07-01', endDate: '2026-07-05', total: 0, isPartial: true })
    expect(bands[4]).toEqual({ weekIndex: 4, startDate: '2026-07-27', endDate: '2026-07-31', total: 0, isPartial: true })
  })
})

describe('spendingPaceSeries', () => {
  it('accumulates this-month spending up to asOfDay and projects the remainder at the current daily rate', () => {
    const txs = [
      tx({ date: '2026-06-01', amount: -10000 }),
      tx({ date: '2026-06-02', amount: -10000 }),
    ]
    const result = spendingPaceSeries(txs, '2026-06', 2)
    expect(result.asOfDay).toBe(2)
    expect(result.points[0].thisMonth).toBe(10000)
    expect(result.points[1].thisMonth).toBe(20000)
    expect(result.points[1].thisMonthProjected).toBe(20000)
    // daily rate = 20000/2 = 10000/day; 30-day month -> projected total 300000
    expect(result.points[29].thisMonthProjected).toBe(300000)
    expect(result.points[2].thisMonth).toBeNull()
    expect(result.projectedMonthEndTotal).toBe(300000)
  })

  it('computes percent vs last month at the same day-of-month', () => {
    const txs = [
      tx({ date: '2026-06-01', amount: -20000 }),
      tx({ date: '2026-05-01', amount: -10000 }),
    ]
    const result = spendingPaceSeries(txs, '2026-06', 1)
    expect(result.points[0].lastMonth).toBe(10000)
    expect(result.percentVsLastMonthSameDay).toBeCloseTo(1) // (20000-10000)/10000
  })

  it('returns null percentVsLastMonthSameDay when last month has no data at that day', () => {
    const txs = [tx({ date: '2026-06-01', amount: -20000 })]
    const result = spendingPaceSeries(txs, '2026-06', 1)
    expect(result.percentVsLastMonthSameDay).toBeNull()
  })

  it('clamps points to the viewed month\'s actual day count even when a comparison month is longer', () => {
    // 2026-06 has 30 days, but the previous month (2026-05) has 31 days.
    const txs: Transaction[] = []
    const result = spendingPaceSeries(txs, '2026-06', 1)
    expect(result.points).toHaveLength(30)
    expect(result.points[result.points.length - 1].day).toBe(30)
  })

  it('clamps an out-of-range asOfDay (e.g. the 31 sentinel used for past months) to the month\'s day count', () => {
    // 2026-06 has 30 days; SpendingPaceChart passes asOfDay=31 for any non-current month.
    // Without clamping, the daily rate is diluted by dividing by 31 instead of 30, and the
    // same-day lookup into the previous month (2026-05, 31 days) reads past the truncated
    // 30-length points array, silently producing percentVsLastMonthSameDay = null.
    const txs = [
      tx({ date: '2026-06-01', amount: -6000 }),
      tx({ date: '2026-06-02', amount: -6000 }),
      tx({ date: '2026-05-01', amount: -3000 }),
      tx({ date: '2026-05-02', amount: -3000 }),
    ]
    const result = spendingPaceSeries(txs, '2026-06', 31)
    expect(result.asOfDay).toBe(30)
    expect(result.percentVsLastMonthSameDay).toBeCloseTo(1) // (12000 - 6000) / 6000
    expect(result.projectedMonthEndTotal).toBe(12000) // dailyRate = 12000/30, not diluted by /31
  })
})

describe('monthInfographics', () => {
  it('computes the biggest spend day, delivery/coffee totals, daily average, most frequent merchant, and no-spend days', () => {
    const txs = [
      tx({ date: '2026-06-01', amount: -50000, category: '식비', subcategory: '배달', content: '배달의민족' }),
      tx({ date: '2026-06-01', amount: -5000, category: '카페/간식', subcategory: '커피/음료', content: '스타벅스' }),
      tx({ date: '2026-06-02', amount: -3000, category: '카페/간식', subcategory: '커피/음료', content: '스타벅스' }),
      tx({ date: '2026-06-03', amount: -3000, category: '카페/간식', subcategory: '커피/음료', content: '스타벅스' }),
    ]
    const result = monthInfographics(txs, '2026-06')
    expect(result.biggestSpendDay).toEqual({ date: '2026-06-01', amount: 55000 })
    expect(result.deliveryCount).toBe(1)
    expect(result.deliveryTotal).toBe(50000)
    expect(result.coffeeTotal).toBe(11000)
    expect(result.mostFrequentMerchant).toEqual({ content: '스타벅스', count: 3 })
    expect(result.noSpendDayCount).toBe(27) // 30 days in June, 3 days with spending
  })

  it('returns null biggestSpendDay/mostFrequentMerchant when there is no spending at all', () => {
    const result = monthInfographics([], '2026-06')
    expect(result.biggestSpendDay).toBeNull()
    expect(result.mostFrequentMerchant).toBeNull()
    expect(result.noSpendDayCount).toBe(30)
  })
})
