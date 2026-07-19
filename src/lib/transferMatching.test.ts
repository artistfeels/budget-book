import { describe, it, expect } from 'vitest'
import { dateTimeToMinutes, matchTransferPairs, type TransferCandidate } from './transferMatching'

function candidate(id: string, date: string, time: string, amount: number, paymentMethod: string): TransferCandidate {
  return { id, amount, paymentMethod, dateTimeMinutes: dateTimeToMinutes(date, time) }
}

describe('matchTransferPairs', () => {
  it('pairs a normal opposite-sign, different-account, within-3-minutes transfer', () => {
    const a = candidate('a', '2026-07-18', '23:34:00', -120000, 'NH주거래우대통장')
    const b = candidate('b', '2026-07-18', '23:34:36', 120000, '네이버페이 머니')
    const result = matchTransferPairs([a, b])
    expect(result.pairs).toEqual([{ a: 'a', b: 'b' }])
    expect(result.unmatchedIds).toEqual([])
  })

  it('does not pair when more than 3 minutes apart', () => {
    const a = candidate('a', '2026-07-18', '23:30:00', -120000, 'NH주거래우대통장')
    const b = candidate('b', '2026-07-18', '23:34:01', 120000, '네이버페이 머니')
    const result = matchTransferPairs([a, b])
    expect(result.pairs).toEqual([])
    expect(result.unmatchedIds.sort()).toEqual(['a', 'b'])
  })

  it('does not pair when the payment method is the same account', () => {
    const a = candidate('a', '2026-07-18', '23:34:00', -120000, 'NH주거래우대통장')
    const b = candidate('b', '2026-07-18', '23:34:10', 120000, 'NH주거래우대통장')
    const result = matchTransferPairs([a, b])
    expect(result.pairs).toEqual([])
    expect(result.unmatchedIds.sort()).toEqual(['a', 'b'])
  })

  it('greedily matches the closest candidate when multiple share the same amount', () => {
    const out = candidate('out', '2026-07-18', '12:00:00', -50000, 'NH주거래우대통장')
    const near = candidate('near', '2026-07-18', '12:01:00', 50000, '네이버페이 머니')
    const far = candidate('far', '2026-07-18', '12:02:30', 50000, '카카오페이 머니')
    const result = matchTransferPairs([out, near, far])
    expect(result.pairs).toEqual([{ a: 'out', b: 'near' }])
    expect(result.unmatchedIds).toEqual(['far'])
  })

  it('matches the globally closest pair first, not whichever candidate is scanned first', () => {
    // a1 and a2 both compete for b. a1 is 2 minutes from b, a2 is 0 minutes from b.
    // Per design doc 3.6, ALL candidate pairs must be sorted by time diff and matched
    // greedily in that global order, so the closest pair (a2<->b) must win even though
    // a1 appears earlier in the input array.
    const a1 = candidate('a1', '2026-07-18', '12:00:00', -50000, 'NH주거래우대통장')
    const a2 = candidate('a2', '2026-07-18', '12:00:02', -50000, '카카오페이 머니')
    const b = candidate('b', '2026-07-18', '12:00:02', 50000, '네이버페이 머니')
    const result = matchTransferPairs([a1, a2, b])
    expect(result.pairs).toEqual([{ a: 'a2', b: 'b' }])
    expect(result.unmatchedIds).toEqual(['a1'])
  })

  it('leaves a transfer with no counterpart as unmatched', () => {
    const a = candidate('a', '2026-07-18', '23:34:00', -120000, 'NH주거래우대통장')
    const result = matchTransferPairs([a])
    expect(result.pairs).toEqual([])
    expect(result.unmatchedIds).toEqual(['a'])
  })
})
