import { describe, it, expect } from 'vitest'
import { detectCategoryAnomalies, detectLargeTransactions, median } from './anomalies'
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

/** 2026-01 ~ 2026-06 동안 매달 식비 30만원 근처, 쇼핑 5만원 */
function steadyHistory(): Transaction[] {
  const food = [300_000, 310_000, 290_000, 305_000, 295_000, 300_000]
  return food.flatMap((amount, i) => {
    const month = `2026-0${i + 1}`
    return [
      tx({ date: `${month}-10`, category: '식비', amount: -amount }),
      tx({ date: `${month}-12`, category: '쇼핑', amount: -50_000 }),
    ]
  })
}

describe('median', () => {
  it('handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([])).toBe(0)
  })
})

describe('detectCategoryAnomalies', () => {
  it('flags a category far above its usual monthly spending', () => {
    const txs = [...steadyHistory(), tx({ date: '2026-07-10', category: '식비', amount: -600_000 })]
    const result = detectCategoryAnomalies(txs, '2026-07')
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('식비')
    expect(result[0].typicalAmount).toBe(300_000)
  })

  it('ignores normal month-to-month wobble', () => {
    const txs = [...steadyHistory(), tx({ date: '2026-07-10', category: '식비', amount: -320_000 })]
    expect(detectCategoryAnomalies(txs, '2026-07')).toEqual([])
  })

  it('ignores increases smaller than the minimum won difference', () => {
    const txs = [...steadyHistory(), tx({ date: '2026-07-12', category: '쇼핑', amount: -90_000 })]
    expect(detectCategoryAnomalies(txs, '2026-07')).toEqual([])
  })

  it('flags a rarely used category that suddenly gets a large bill', () => {
    const txs = [...steadyHistory(), tx({ date: '2026-07-20', category: '의료', amount: -400_000 })]
    expect(detectCategoryAnomalies(txs, '2026-07').map((a) => a.category)).toEqual(['의료'])
  })

  it('needs at least three months of history', () => {
    const txs = [
      tx({ date: '2026-05-10', amount: -100_000 }),
      tx({ date: '2026-06-10', amount: -100_000 }),
      tx({ date: '2026-07-10', amount: -900_000 }),
    ]
    expect(detectCategoryAnomalies(txs, '2026-07')).toEqual([])
  })

  it('nets refunds and respects flow overrides', () => {
    const txs = [
      ...steadyHistory(),
      tx({ date: '2026-07-10', category: '식비', amount: -600_000 }),
      tx({ date: '2026-07-11', category: '식비', amount: 290_000 }),
    ]
    expect(detectCategoryAnomalies(txs, '2026-07')).toEqual([])

    const overridden = [...steadyHistory(), tx({ date: '2026-07-10', category: '식비', amount: -600_000, flowTypeOverride: 'neutral' })]
    expect(detectCategoryAnomalies(overridden, '2026-07')).toEqual([])
  })
})

describe('detectLargeTransactions', () => {
  it('flags a single payment far larger than the category usually sees', () => {
    const txs = [
      ...Array.from({ length: 6 }, (_, i) => tx({ date: `2026-0${i + 1}-05`, category: '식비', amount: -20_000 })),
      tx({ date: '2026-07-05', category: '식비', amount: -180_000, content: '회식' }),
      tx({ date: '2026-07-06', category: '식비', amount: -25_000 }),
    ]
    const result = detectLargeTransactions(txs, '2026-07')
    expect(result).toHaveLength(1)
    expect(result[0].transaction.content).toBe('회식')
    expect(result[0].typicalAmount).toBe(20_000)
  })

  it('skips categories without enough past payments', () => {
    const txs = [
      tx({ date: '2026-06-05', category: '여행', amount: -50_000 }),
      tx({ date: '2026-07-05', category: '여행', amount: -900_000 }),
    ]
    expect(detectLargeTransactions(txs, '2026-07')).toEqual([])
  })

  it('ignores large payments below the absolute floor', () => {
    const txs = [
      ...Array.from({ length: 6 }, (_, i) => tx({ date: `2026-0${i + 1}-05`, category: '카페', amount: -5_000 })),
      tx({ date: '2026-07-05', category: '카페', amount: -60_000 }),
    ]
    expect(detectLargeTransactions(txs, '2026-07')).toEqual([])
  })
})
