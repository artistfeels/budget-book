import { describe, expect, it } from 'vitest'
import { elapsedDaysInMonth, formatDayLabel, formatMonthLabel, shiftMonth } from './month'

describe('month helpers', () => {
  it('shifts across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2025-12', 1)).toBe('2026-01')
  })

  it('counts elapsed days for past, current and future months', () => {
    const today = new Date(2026, 8, 15) // 2026-09-15
    expect(elapsedDaysInMonth('2026-08', today)).toBe(31)
    expect(elapsedDaysInMonth('2026-09', today)).toBe(15)
    expect(elapsedDaysInMonth('2026-10', today)).toBe(0)
  })

  it('formats dates and months for people', () => {
    expect(formatDayLabel('2026-09-15')).toBe('9월 15일 (화)')
    expect(formatMonthLabel('2026-09')).toBe('2026년 9월')
  })
})
