import { describe, it, expect } from 'vitest'
import { computeTransactionId } from './idHash'

const base = {
  date: '2026-07-18',
  time: '23:34:36',
  type: '이체' as const,
  category: '내계좌이체',
  subcategory: '미분류',
  content: '네이버페이충전',
  amount: -120000,
  paymentMethod: 'NH주거래우대통장',
}

describe('computeTransactionId', () => {
  it('is deterministic for identical input', async () => {
    const id1 = await computeTransactionId(base)
    const id2 = await computeTransactionId(base)
    expect(id1).toBe(id2)
    expect(id1).toHaveLength(64)
  })

  it('differs when amount differs', async () => {
    const id1 = await computeTransactionId(base)
    const id2 = await computeTransactionId({ ...base, amount: -120001 })
    expect(id1).not.toBe(id2)
  })

  it('differs when content differs', async () => {
    const id1 = await computeTransactionId(base)
    const id2 = await computeTransactionId({ ...base, content: '다른 내용' })
    expect(id1).not.toBe(id2)
  })
})
