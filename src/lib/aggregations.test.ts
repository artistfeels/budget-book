import { describe, it, expect } from 'vitest'
import { listAvailableMonths, monthOverMonthChange, resolvedFlowType, summarizeByMonth } from './aggregations'
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

describe('resolvedFlowType', () => {
  it('uses the override when present', () => {
    expect(resolvedFlowType(tx({ flowType: 'spending', flowTypeOverride: 'saving' }))).toBe('saving')
  })

  it('falls back to the computed flowType when no override', () => {
    expect(resolvedFlowType(tx({ flowType: 'spending', flowTypeOverride: null }))).toBe('spending')
  })
})

describe('summarizeByMonth', () => {
  it('computes saving as the residual of income minus spending for the month', () => {
    const txs = [
      tx({ date: '2026-07-05', amount: 3000000, flowType: 'income' }),
      tx({ date: '2026-07-10', amount: -50000, flowType: 'spending' }),
    ]
    const [july] = summarizeByMonth(txs)
    expect(july).toEqual({ month: '2026-07', income: 3000000, spending: 50000, saving: 2950000, netCashFlow: 2950000 })
  })

  it('nets refund rows against spending in the same category (positive-amount spending row)', () => {
    const txs = [
      tx({ date: '2026-07-10', amount: -20000, flowType: 'spending' }),
      tx({ date: '2026-07-11', amount: 2000, flowType: 'spending' }), // partial refund
    ]
    const [july] = summarizeByMonth(txs)
    expect(july.spending).toBe(18000)
  })

  it('clamps spending to 0 when refunds exceed the original outflow in a month', () => {
    const txs = [
      tx({ date: '2026-07-10', amount: -10000, flowType: 'spending' }),
      tx({ date: '2026-07-11', amount: 15000, flowType: 'spending' }), // over-refund
    ]
    const [july] = summarizeByMonth(txs)
    expect(july.spending).toBe(0)
  })

  it('excludes neutral transactions entirely', () => {
    const txs = [tx({ date: '2026-07-10', amount: -251310, flowType: 'neutral' })]
    const result = summarizeByMonth(txs)
    expect(result).toEqual([])
  })

  it('groups multiple months and sorts them chronologically', () => {
    const txs = [
      tx({ date: '2026-08-01', amount: -1000, flowType: 'spending' }),
      tx({ date: '2026-07-01', amount: -1000, flowType: 'spending' }),
    ]
    const result = summarizeByMonth(txs)
    expect(result.map((r) => r.month)).toEqual(['2026-07', '2026-08'])
  })

  it('respects a manual override when computing the bucket', () => {
    const txs = [tx({ date: '2026-07-10', amount: -50000, flowType: 'spending', flowTypeOverride: 'neutral' })]
    const [july] = summarizeByMonth(txs)
    expect(july).toBeUndefined()
  })

  it('clamps saving to 0 in an overspend month, while netCashFlow stays negative', () => {
    const txs = [
      tx({ date: '2026-07-05', amount: 1000000, flowType: 'income' }),
      tx({ date: '2026-07-10', amount: -1500000, flowType: 'spending' }),
    ]
    const [july] = summarizeByMonth(txs)
    expect(july.saving).toBe(0)
    expect(july.netCashFlow).toBe(-500000)
  })
})

describe('listAvailableMonths', () => {
  it('returns the distinct sorted list of months present in the data', () => {
    const txs = [tx({ date: '2025-07-19' }), tx({ date: '2026-07-19' }), tx({ date: '2025-08-01' })]
    expect(listAvailableMonths(txs)).toEqual(['2025-07', '2025-08', '2026-07'])
  })
})

describe('monthOverMonthChange', () => {
  it('computes a positive percent increase', () => {
    expect(monthOverMonthChange(120, 100)).toBeCloseTo(0.2)
  })

  it('computes a negative percent decrease', () => {
    expect(monthOverMonthChange(80, 100)).toBeCloseTo(-0.2)
  })

  it('returns null when the previous value is zero (undefined percent change)', () => {
    expect(monthOverMonthChange(50, 0)).toBeNull()
  })
})
