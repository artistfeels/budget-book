import { describe, it, expect } from 'vitest'
import { formatKRW, formatManwon } from './format'

describe('formatKRW', () => {
  it('formats positive amounts with 원 suffix and comma grouping', () => {
    expect(formatKRW(1234567)).toBe('1,234,567원')
  })

  it('formats negative amounts with a leading minus', () => {
    expect(formatKRW(-5000)).toBe('-5,000원')
  })

  it('formats zero', () => {
    expect(formatKRW(0)).toBe('0원')
  })
})

describe('formatManwon', () => {
  it('abbreviates to 만원 with one decimal', () => {
    expect(formatManwon(1234000)).toBe('123.4만원')
  })

  it('drops trailing .0', () => {
    expect(formatManwon(1230000)).toBe('123만원')
  })
})
