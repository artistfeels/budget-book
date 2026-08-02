export type TransactionType = '수입' | '지출' | '이체'
export type FlowType = 'income' | 'spending' | 'neutral'

export interface Transaction {
  id: string
  date: string // YYYY-MM-DD
  time: string // HH:MM:SS
  type: TransactionType
  category: string
  subcategory: string
  content: string
  amount: number // signed, trusted as-is from source
  currency: string
  paymentMethod: string
  memo: string | null
  flowType: FlowType
  flowTypeOverride: 'spending' | 'neutral' | null
  transferPairId: string | null
  isPairedTransfer: boolean
  isUnmatchedTransfer: boolean
}

export interface ClassificationRule {
  id: string
  matchType: 'content' | 'payment_method'
  matchValue: string
  flowType: 'spending' | 'neutral'
}
