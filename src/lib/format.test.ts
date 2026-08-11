import { describe, it, expect } from 'vitest'
import { formatKRW, formatKRWCompact, formatManwon } from './format'

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

describe('formatKRWCompact', () => {
  it('만 단위 미만은 천 단위 구분자만 붙인다', () => {
    expect(formatKRWCompact(0)).toBe('0')
    expect(formatKRWCompact(850)).toBe('850')
    expect(formatKRWCompact(8500)).toBe('8,500')
    expect(formatKRWCompact(9999)).toBe('9,999')
  })

  it('만 단위는 만으로 축약한다', () => {
    expect(formatKRWCompact(10000)).toBe('1만')
    expect(formatKRWCompact(1200000)).toBe('120만')
    expect(formatKRWCompact(15000)).toBe('1.5만')
  })

  it('만 단위에서 소수 둘째 자리는 버린다', () => {
    expect(formatKRWCompact(12345)).toBe('1.2만')
  })

  it('억 단위는 억으로 축약한다', () => {
    expect(formatKRWCompact(100000000)).toBe('1억')
    expect(formatKRWCompact(120000000)).toBe('1.2억')
    expect(formatKRWCompact(2500000000)).toBe('25억')
  })

  it('음수는 부호를 유지한다', () => {
    expect(formatKRWCompact(-1200000)).toBe('-120만')
    expect(formatKRWCompact(-8500)).toBe('-8,500')
  })
})
