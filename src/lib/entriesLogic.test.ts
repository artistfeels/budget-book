import { describe, it, expect } from 'vitest'
import {
  applyEntryFieldPatch,
  defaultDateForMonth,
  filterByMonth,
  filterBySection,
  filterExcluded,
  isPartialMonth,
  searchEntries,
  sortEntries,
} from './entriesLogic'
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

describe('filterBySection', () => {
  it('returns only transactions resolved to the given section', () => {
    const txs = [tx({ id: 'a', flowType: 'spending' }), tx({ id: 'b', flowType: 'income' })]
    expect(filterBySection(txs, 'spending').map((t) => t.id)).toEqual(['a'])
  })

  it('resolves overrides before matching the section', () => {
    const txs = [tx({ id: 'a', flowType: 'income', flowTypeOverride: 'spending' })]
    expect(filterBySection(txs, 'spending').map((t) => t.id)).toEqual(['a'])
    expect(filterBySection(txs, 'income')).toEqual([])
  })

  it('excludes neutral transactions from every section', () => {
    const txs = [tx({ id: 'a', flowType: 'neutral' })]
    expect(filterBySection(txs, 'income')).toEqual([])
    expect(filterBySection(txs, 'spending')).toEqual([])
  })
})

describe('filterExcluded', () => {
  it('returns only transactions manually overridden to neutral', () => {
    const txs = [
      tx({ id: 'a', flowType: 'spending', flowTypeOverride: 'neutral' }),
      tx({ id: 'b', flowType: 'spending', flowTypeOverride: null }),
      tx({ id: 'c', flowType: 'neutral', flowTypeOverride: null }), // auto-neutral (e.g. a real paired transfer)
    ]
    expect(filterExcluded(txs).map((t) => t.id)).toEqual(['a'])
  })

  it('returns an empty array when nothing has been manually excluded', () => {
    const txs = [tx({ id: 'a', flowType: 'spending' }), tx({ id: 'b', flowType: 'neutral' })]
    expect(filterExcluded(txs)).toEqual([])
  })
})

describe('filterByMonth', () => {
  it('keeps only transactions whose date falls in the given month', () => {
    const txs = [tx({ id: 'a', date: '2026-07-15' }), tx({ id: 'b', date: '2026-08-01' })]
    expect(filterByMonth(txs, '2026-07').map((t) => t.id)).toEqual(['a'])
  })
})

describe('isPartialMonth', () => {
  it('flags the earliest month when data starts after the 1st', () => {
    const txs = [tx({ date: '2025-07-19' }), tx({ date: '2026-07-19' })]
    expect(isPartialMonth(txs, '2025-07')).toBe(true)
  })

  it('flags the latest month when data ends before the last day of that month', () => {
    const txs = [tx({ date: '2025-07-19' }), tx({ date: '2026-07-19' })]
    expect(isPartialMonth(txs, '2026-07')).toBe(true)
  })

  it('does not flag a fully-covered middle month', () => {
    const txs = [tx({ date: '2025-07-19' }), tx({ date: '2025-08-15' }), tx({ date: '2026-07-19' })]
    expect(isPartialMonth(txs, '2025-08')).toBe(false)
  })

  it('returns false for an empty dataset', () => {
    expect(isPartialMonth([], '2026-07')).toBe(false)
  })
})

describe('defaultDateForMonth', () => {
  it("returns today's date when the selected month is the current real month", () => {
    const today = new Date(2026, 6, 15) // 2026-07-15 (month is 0-indexed)
    expect(defaultDateForMonth('2026-07', today)).toBe('2026-07-15')
  })

  it('returns the 1st of the month when viewing a past or future month', () => {
    const today = new Date(2026, 6, 15)
    expect(defaultDateForMonth('2026-05', today)).toBe('2026-05-01')
  })
})

describe('searchEntries', () => {
  it('matches content case-insensitively', () => {
    const txs = [tx({ id: 'a', content: '스타벅스' })]
    expect(searchEntries(txs, '벅스').map((t) => t.id)).toEqual(['a'])
  })

  it('matches memo when content does not match', () => {
    const txs = [tx({ id: 'a', content: '스타벅스', memo: '생일선물' })]
    expect(searchEntries(txs, '생일').map((t) => t.id)).toEqual(['a'])
  })

  it('treats a null memo as empty rather than throwing', () => {
    const txs = [tx({ id: 'a', content: '스타벅스', memo: null })]
    expect(() => searchEntries(txs, '없음')).not.toThrow()
    expect(searchEntries(txs, '없음')).toEqual([])
  })

  it('returns all transactions when the query is blank', () => {
    const txs = [tx({ id: 'a' }), tx({ id: 'b' })]
    expect(searchEntries(txs, '  ')).toHaveLength(2)
  })
})

describe('sortEntries', () => {
  it('sorts by date ascending', () => {
    const txs = [tx({ id: 'a', date: '2026-07-20' }), tx({ id: 'b', date: '2026-07-01' })]
    expect(sortEntries(txs, 'date', 'asc').map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('sorts by date descending', () => {
    const txs = [tx({ id: 'a', date: '2026-07-20' }), tx({ id: 'b', date: '2026-07-01' })]
    expect(sortEntries(txs, 'date', 'desc').map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('sorts by amount ascending', () => {
    const txs = [tx({ id: 'a', amount: -500 }), tx({ id: 'b', amount: -2000 })]
    expect(sortEntries(txs, 'amount', 'asc').map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('does not mutate the input array', () => {
    const txs = [tx({ id: 'a', date: '2026-07-20' }), tx({ id: 'b', date: '2026-07-01' })]
    sortEntries(txs, 'date', 'asc')
    expect(txs.map((t) => t.id)).toEqual(['a', 'b'])
  })
})

describe('applyEntryFieldPatch', () => {
  it('applies a positive amount for the income section', () => {
    expect(applyEntryFieldPatch('income', 'amount', 50000)).toEqual({ amount: 50000 })
  })

  it('applies a negative amount for the spending section', () => {
    expect(applyEntryFieldPatch('spending', 'amount', 50000)).toEqual({ amount: -50000 })
  })

  it('preserves the positive sign of an existing refund row in the spending section', () => {
    expect(applyEntryFieldPatch('spending', 'amount', 30000, 12000)).toEqual({ amount: 30000 })
  })

  it('keeps an existing negative spending amount negative', () => {
    expect(applyEntryFieldPatch('spending', 'amount', 30000, -12000)).toEqual({ amount: -30000 })
  })

  it('preserves the sign even when the typed value carries the opposite sign', () => {
    expect(applyEntryFieldPatch('spending', 'amount', -30000, 12000)).toEqual({ amount: 30000 })
    expect(applyEntryFieldPatch('income', 'amount', -30000, -12000)).toEqual({ amount: -30000 })
  })

  it('falls back to the section default sign when currentAmount is 0 (fresh draft row)', () => {
    expect(applyEntryFieldPatch('spending', 'amount', 30000, 0)).toEqual({ amount: -30000 })
    expect(applyEntryFieldPatch('income', 'amount', 30000, 0)).toEqual({ amount: 30000 })
  })

  it('falls back to the section default sign when currentAmount is omitted or undefined', () => {
    expect(applyEntryFieldPatch('spending', 'amount', 30000)).toEqual({ amount: -30000 })
    expect(applyEntryFieldPatch('spending', 'amount', 30000, undefined)).toEqual({ amount: -30000 })
    expect(applyEntryFieldPatch('income', 'amount', 30000, undefined)).toEqual({ amount: 30000 })
  })

  it('ignores currentAmount for non-amount fields', () => {
    expect(applyEntryFieldPatch('spending', 'content', '환불', 12000)).toEqual({ content: '환불' })
  })

  it('resets subcategory to 미분류 when the spending category changes', () => {
    expect(applyEntryFieldPatch('spending', 'category', '생활')).toEqual({ category: '생활', subcategory: '미분류' })
  })

  it('does not touch subcategory when the income category changes', () => {
    expect(applyEntryFieldPatch('income', 'category', '용돈')).toEqual({ category: '용돈' })
  })

  it('passes other fields through as-is', () => {
    expect(applyEntryFieldPatch('spending', 'content', '스타벅스')).toEqual({ content: '스타벅스' })
    expect(applyEntryFieldPatch('spending', 'paymentMethod', '토스 간편결제')).toEqual({ paymentMethod: '토스 간편결제' })
    expect(applyEntryFieldPatch('spending', 'date', '2026-07-10')).toEqual({ date: '2026-07-10' })
    expect(applyEntryFieldPatch('spending', 'subcategory', '배달')).toEqual({ subcategory: '배달' })
  })
})
