import { describe, it, expect } from 'vitest'
import {
  blendSubscriptionProjection,
  dailySummaries,
  monthInfographics,
  spendingPaceSeries,
  weeklySpendingBands,
  type SpendingPacePoint,
} from './monthDetailAggregations'
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
    expect(bands[0]).toEqual({
      weekIndex: 0,
      startDate: '2026-06-01',
      endDate: '2026-06-07',
      total: 7000,
      income: 0,
      isPartial: false,
    })
    expect(bands[4]).toEqual({
      weekIndex: 4,
      startDate: '2026-06-29',
      endDate: '2026-06-30',
      total: 3000,
      income: 0,
      isPartial: true,
    })
  })

  it('starts with a partial week when the month does not begin on a Monday', () => {
    // 2026-07-01 is a Wednesday, 2026-07-31 is a Friday (31 days total)
    const txs: Transaction[] = []
    const bands = weeklySpendingBands(txs, '2026-07')
    expect(bands).toHaveLength(5)
    expect(bands[0]).toEqual({
      weekIndex: 0,
      startDate: '2026-07-01',
      endDate: '2026-07-05',
      total: 0,
      income: 0,
      isPartial: true,
    })
    expect(bands[4]).toEqual({
      weekIndex: 4,
      startDate: '2026-07-27',
      endDate: '2026-07-31',
      total: 0,
      income: 0,
      isPartial: true,
    })
  })

  it('sums income separately from spending within each week', () => {
    const txs = [
      tx({ date: '2026-06-02', amount: 3000000, flowType: 'income', type: '수입' }),
      tx({ date: '2026-06-03', amount: -5000 }),
    ]
    const bands = weeklySpendingBands(txs, '2026-06')
    expect(bands[0].income).toBe(3000000)
    expect(bands[0].total).toBe(5000)
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

  it('falls back to the previous month\'s last day when the previous month is shorter (e.g. July viewed fully vs June)', () => {
    // 2026-07 has 31 days; 2026-06 (the previous month) has only 30.
    const txs = [
      tx({ date: '2026-07-01', amount: -20000 }),
      tx({ date: '2026-06-01', amount: -10000 }),
    ]
    const result = spendingPaceSeries(txs, '2026-07', 31)
    expect(result.asOfDay).toBe(31)
    expect(result.points[29].lastMonth).toBe(10000) // June's cumulative total through its last day (30)
    expect(result.percentVsLastMonthSameDay).toBeCloseTo(1) // (20000-10000)/10000
  })

  it('holds a shorter baseline month\'s total in the 3-month average instead of dropping it once its days run out', () => {
    // Viewed month 2026-03 has 31 days; baseline 2026-02 (one of the three trailing months) has only 28.
    const txs = [
      tx({ date: '2026-02-01', amount: -280000 }),
      tx({ date: '2026-01-01', amount: -31000 }),
      tx({ date: '2025-12-01', amount: -31000 }),
    ]
    const result = spendingPaceSeries(txs, '2026-03', 31)
    const expectedAvg = (280000 + 31000 + 31000) / 3
    expect(result.points[27].threeMonthAvg).toBeCloseTo(expectedAvg) // day 28: Feb's last day
    expect(result.points[28].threeMonthAvg).toBeCloseTo(expectedAvg) // day 29: Feb has ended but must still count
  })

  it('projects using the trailing-3-month pattern shape scaled by this month\'s pace, catching a known spike (e.g. rent) before it happens', () => {
    const txs = [
      tx({ date: '2026-06-05', amount: -10000 }),
      tx({ date: '2026-06-23', amount: -700000 }),
      tx({ date: '2026-05-05', amount: -10000 }),
      tx({ date: '2026-05-23', amount: -700000 }),
      tx({ date: '2026-04-05', amount: -10000 }),
      tx({ date: '2026-04-23', amount: -700000 }),
      tx({ date: '2026-07-05', amount: -10000 }), // this month tracks the baseline exactly through day 10
    ]
    const result = spendingPaceSeries(txs, '2026-07', 10)
    // A flat daily-rate projection (old behavior) would give 10000/10 * 31 ≈ 31,000, missing the
    // day-23 rent spike entirely. The pattern-scaled projection should land near the full 710,000.
    expect(result.projectedMonthEndTotal).toBeCloseTo(710000)
  })

  it('falls back to a flat daily-rate projection when there is no usable historical baseline yet', () => {
    const txs = [tx({ date: '2026-06-01', amount: -10000 }), tx({ date: '2026-06-02', amount: -10000 })]
    const result = spendingPaceSeries(txs, '2026-06', 2)
    expect(result.projectedMonthEndTotal).toBe(300000) // dailyRate 10000/day * 30 days, no baseline to pattern-match against
  })

  it('clamps the pace-scale factor so a single early outlier cannot blow up the month-end projection', () => {
    const txs = [
      tx({ date: '2026-06-05', amount: -10000 }),
      tx({ date: '2026-06-23', amount: -700000 }),
      tx({ date: '2026-05-05', amount: -10000 }),
      tx({ date: '2026-05-23', amount: -700000 }),
      tx({ date: '2026-04-05', amount: -10000 }),
      tx({ date: '2026-04-23', amount: -700000 }),
      tx({ date: '2026-07-05', amount: -500000 }), // 50x the baseline's day-5 spend
    ]
    const result = spendingPaceSeries(txs, '2026-07', 10)
    // Unclamped scale would be 500000/10000 = 50x, projecting into the millions. Clamped to 3x:
    // 500000 + (710000 - 10000) * 3 = 2,600,000.
    expect(result.projectedMonthEndTotal).toBeCloseTo(2600000)
  })
})

describe('blendSubscriptionProjection', () => {
  function buildFullPoints(daysInMonth: number, asOfDay: number, actualSoFar: number): SpendingPacePoint[] {
    const points: SpendingPacePoint[] = []
    for (let day = 1; day <= daysInMonth; day++) {
      points.push({
        day,
        thisMonth: day <= asOfDay ? actualSoFar : null,
        thisMonthProjected: null, // untouched by blendSubscriptionProjection — only thisMonth/day are read
        lastMonth: null,
        threeMonthAvg: null,
      })
    }
    return points
  }

  function buildNonSubPoints(
    daysInMonth: number,
    asOfDay: number,
    actualSoFar: number,
    projectedFn: (day: number) => number
  ): SpendingPacePoint[] {
    const points: SpendingPacePoint[] = []
    for (let day = 1; day <= daysInMonth; day++) {
      points.push({
        day,
        thisMonth: day <= asOfDay ? actualSoFar : null,
        // Mirrors spendingPaceSeries: the projected series starts AT asOfDay, so day === asOfDay
        // carries a projected value too (matching the actual at that point).
        thisMonthProjected: day >= asOfDay ? projectedFn(day) : null,
        lastMonth: null,
        threeMonthAvg: null,
      })
    }
    return points
  }

  it('adds an already-posted subscription back as a flat offset, on top of the untouched non-subscription pace', () => {
    const full = buildFullPoints(30, 10, 400000) // 400k actual so far, including a subscription that already posted
    const nonSub = buildNonSubPoints(30, 10, 100000, () => 100000) // subscription-free baseline: flat, no growth
    const result = blendSubscriptionProjection(full, nonSub, 10, 30, 300000, [])
    expect(result.points[9].thisMonthProjected).toBe(400000) // day 10 (asOfDay): 100000 + 300000 posted offset
    expect(result.points[29].thisMonthProjected).toBe(400000) // flat baseline stays flat once the offset is added
    expect(result.projectedMonthEndTotal).toBe(400000)
  })

  it('adds a pending cost as a full step exactly on its typical due day, undiluted by the pace-scaled baseline', () => {
    const full = buildFullPoints(30, 10, 50000)
    const nonSub = buildNonSubPoints(30, 10, 50000, () => 50000) // flat — a slow-paced baseline that must NOT shrink the rent step
    const result = blendSubscriptionProjection(full, nonSub, 10, 30, 0, [{ amount: 900000, typicalDay: 23 }])
    expect(result.points[21].thisMonthProjected).toBe(50000) // day 22: still before the due day
    expect(result.points[22].thisMonthProjected).toBe(950000) // day 23: the full 900k lands at once
    expect(result.points[29].thisMonthProjected).toBe(950000)
    expect(result.projectedMonthEndTotal).toBe(950000)
  })

  it('pulls an overdue due day (already passed without posting) forward to the next forecastable day', () => {
    const full = buildFullPoints(30, 10, 50000)
    const nonSub = buildNonSubPoints(30, 10, 50000, () => 50000)
    const result = blendSubscriptionProjection(full, nonSub, 10, 30, 0, [{ amount: 900000, typicalDay: 5 }])
    expect(result.points[9].thisMonthProjected).toBe(50000) // day 10 (asOfDay): due day hasn't arrived yet
    expect(result.points[10].thisMonthProjected).toBe(950000) // day 11: pulled forward from the missed day 5
  })

  it('combines the posted offset and pending step for the month-end total', () => {
    const full = buildFullPoints(30, 10, 300000)
    const nonSub = buildNonSubPoints(30, 10, 100000, (day) => 100000 + (day - 10) * 5000) // grows with pace
    const result = blendSubscriptionProjection(full, nonSub, 10, 30, 100000, [{ amount: 900000, typicalDay: 25 }])
    const nonSubMonthEnd = 100000 + (30 - 10) * 5000
    expect(result.projectedMonthEndTotal).toBe(nonSubMonthEnd + 100000 + 900000)
  })

  it('leaves days before asOfDay untouched (still actual, still no projected value)', () => {
    const full = buildFullPoints(30, 10, 400000)
    const nonSub = buildNonSubPoints(30, 10, 100000, () => 100000)
    const result = blendSubscriptionProjection(full, nonSub, 10, 30, 300000, [])
    expect(result.points[4].thisMonth).toBe(400000) // day 5
    expect(result.points[4].thisMonthProjected).toBeNull()
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
