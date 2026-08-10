import { describe, it, expect } from 'vitest'
import { niceAxisTicks } from './chartTicks'

describe('niceAxisTicks', () => {
  it('snaps to round steps like 100만/200만/300만/400만 for a ~3.8M-won range', () => {
    expect(niceAxisTicks(3800000)).toEqual([0, 1000000, 2000000, 3000000, 4000000])
  })

  it('picks a 2x step when the raw step lands just above 1x magnitude', () => {
    // rawStep = 1,300,000/5 = 260,000 -> magnitude 100,000, residual 2.6 -> step 500,000
    expect(niceAxisTicks(1300000)).toEqual([0, 500000, 1000000, 1500000])
  })

  it('picks a 5x step when the raw step lands just above 2x magnitude', () => {
    // rawStep = 700,000/5 = 140,000 -> magnitude 100,000, residual 1.4 -> step 200,000
    expect(niceAxisTicks(700000)).toEqual([0, 200000, 400000, 600000, 800000])
  })

  it('extends the range below zero for a series that can go negative (e.g. net cash flow)', () => {
    expect(niceAxisTicks(1800000, -900000)).toEqual([-1000000, 0, 1000000, 2000000])
  })

  it('returns a single tick at minValue when the range is empty or inverted', () => {
    expect(niceAxisTicks(0)).toEqual([0])
    expect(niceAxisTicks(-100, 0)).toEqual([0])
  })

  it('respects a custom tick count', () => {
    expect(niceAxisTicks(1000000, 0, 2)).toEqual([0, 500000, 1000000])
  })
})
