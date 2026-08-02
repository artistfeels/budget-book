import type { ClassificationRule, FlowType, TransactionType } from '../types/transaction'

export interface ClassificationInput {
  type: TransactionType
  category: string
  subcategory: string
  content: string
  paymentMethod: string
  amount: number
  isPairedTransfer: boolean
  isUnmatchedTransfer: boolean
  flowTypeOverride: 'spending' | 'neutral' | null
}

const SAVING_PAYMENT_METHODS = ['주택청약종합저축', 'NH청년도약계좌', '월세 보증금']

export function classifyFlowType(input: ClassificationInput, rules: ClassificationRule[]): FlowType {
  if (input.flowTypeOverride) {
    return input.flowTypeOverride
  }

  const matchedRule = rules.find(
    (rule) =>
      (rule.matchType === 'content' && rule.matchValue === input.content) ||
      (rule.matchType === 'payment_method' && rule.matchValue === input.paymentMethod)
  )
  if (matchedRule) {
    return matchedRule.flowType
  }

  if (SAVING_PAYMENT_METHODS.includes(input.paymentMethod) && input.amount < 0) {
    return 'neutral'
  }

  if (input.type === '이체' && input.category === '투자') {
    return 'neutral'
  }

  if (input.type === '지출' && input.category === '금융' && input.subcategory === '증권/투자') {
    return 'neutral'
  }

  if (input.type === '이체' && input.category === '카드대금') {
    return 'neutral'
  }

  if (input.type === '이체' && input.isPairedTransfer) {
    return 'neutral'
  }

  if (input.type === '이체' && input.isUnmatchedTransfer) {
    return 'neutral'
  }

  if (input.type === '이체') {
    return 'neutral'
  }

  if (input.type === '수입') {
    return 'income'
  }

  return 'spending'
}
