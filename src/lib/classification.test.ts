import { describe, it, expect } from 'vitest'
import { classifyFlowType, type ClassificationInput } from './classification'
import type { ClassificationRule } from '../types/transaction'

function base(overrides: Partial<ClassificationInput> = {}): ClassificationInput {
  return {
    type: '지출',
    category: '식비',
    subcategory: '배달',
    content: '쿠팡이츠',
    paymentMethod: '삼성카드 taptap O',
    amount: -14000,
    isPairedTransfer: false,
    isUnmatchedTransfer: false,
    flowTypeOverride: null,
    ...overrides,
  }
}

describe('classifyFlowType', () => {
  it('classifies an ordinary expense as spending', () => {
    expect(classifyFlowType(base(), [])).toBe('spending')
  })

  it('classifies ordinary income as income', () => {
    const input = base({ type: '수입', category: '급여', paymentMethod: 'NH주거래우대통장', amount: 3000000 })
    expect(classifyFlowType(input, [])).toBe('income')
  })

  it('classifies a saving-account payment method as saving regardless of type', () => {
    const input = base({ type: '이체', category: '이체', paymentMethod: '주택청약종합저축', amount: -100000 })
    expect(classifyFlowType(input, [])).toBe('saving')
  })

  it('classifies a positive-amount (inflow) transaction on a saving-account payment method as income, not saving', () => {
    const input = base({
      type: '수입',
      category: '환급',
      paymentMethod: '주택청약종합저축',
      amount: 500000,
    })
    expect(classifyFlowType(input, [])).toBe('income')
  })

  it('classifies an outgoing 이체>투자 as saving', () => {
    const input = base({ type: '이체', category: '투자', paymentMethod: 'MY 입출금통장', amount: -3000000 })
    expect(classifyFlowType(input, [])).toBe('saving')
  })

  it('classifies an incoming 이체>투자 (redemption) as income', () => {
    const input = base({ type: '이체', category: '투자', paymentMethod: 'OK파킹플렉스통장', amount: 1989192 })
    expect(classifyFlowType(input, [])).toBe('income')
  })

  it('classifies 지출>금융>증권/투자 as saving', () => {
    const input = base({ type: '지출', category: '금융', subcategory: '증권/투자', amount: -14260 })
    expect(classifyFlowType(input, [])).toBe('saving')
  })

  it('classifies 이체>카드대금 as neutral', () => {
    const input = base({ type: '이체', category: '카드대금', paymentMethod: 'NH주거래우대통장', amount: -251310 })
    expect(classifyFlowType(input, [])).toBe('neutral')
  })

  it('classifies a paired internal transfer as neutral', () => {
    const input = base({ type: '이체', category: '내계좌이체', isPairedTransfer: true, amount: -120000 })
    expect(classifyFlowType(input, [])).toBe('neutral')
  })

  it('classifies an unmatched internal transfer as neutral', () => {
    const input = base({ type: '이체', category: '내계좌이체', isUnmatchedTransfer: true, amount: 20000 })
    expect(classifyFlowType(input, [])).toBe('neutral')
  })

  it('classifies any other 이체 category (e.g. 현금) as neutral', () => {
    const input = base({ type: '이체', category: '현금', amount: -50000 })
    expect(classifyFlowType(input, [])).toBe('neutral')
  })

  it('a manual override always wins over every automatic rule', () => {
    const input = base({ flowTypeOverride: 'saving' })
    expect(classifyFlowType(input, [])).toBe('saving')
  })

  it('a content-based user rule wins over the default spending classification', () => {
    const input = base({ content: '토스증권 자동이체' })
    const rules: ClassificationRule[] = [
      { id: 'r1', matchType: 'content', matchValue: '토스증권 자동이체', flowType: 'saving' },
    ]
    expect(classifyFlowType(input, rules)).toBe('saving')
  })

  it('a payment-method-based user rule wins over the default spending classification', () => {
    const input = base({ paymentMethod: '내마음대로적금' })
    const rules: ClassificationRule[] = [
      { id: 'r1', matchType: 'payment_method', matchValue: '내마음대로적금', flowType: 'saving' },
    ]
    expect(classifyFlowType(input, rules)).toBe('saving')
  })
})
