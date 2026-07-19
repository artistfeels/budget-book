import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { computeTransactionId } from '../lib/idHash'
import { classifyFlowType } from '../lib/classification'
import { matchTransferPairs, dateTimeToMinutes, type TransferCandidate } from '../lib/transferMatching'
import type { ParsedRawRow } from '../lib/excelParser'
import type { ClassificationRule, Transaction } from '../types/transaction'

interface TransactionRow {
  id: string
  date: string
  time: string
  type: Transaction['type']
  category: string
  subcategory: string
  content: string
  amount: number
  currency: string
  payment_method: string
  memo: string | null
  flow_type: Transaction['flowType']
  flow_type_override: Transaction['flowTypeOverride']
  transfer_pair_id: string | null
  is_paired_transfer: boolean
  is_unmatched_transfer: boolean
}

function rowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    type: row.type,
    category: row.category,
    subcategory: row.subcategory,
    content: row.content,
    amount: row.amount,
    currency: row.currency,
    paymentMethod: row.payment_method,
    memo: row.memo,
    flowType: row.flow_type,
    flowTypeOverride: row.flow_type_override,
    transferPairId: row.transfer_pair_id,
    isPairedTransfer: row.is_paired_transfer,
    isUnmatchedTransfer: row.is_unmatched_transfer,
  }
}

function transactionToRow(t: Transaction): TransactionRow {
  return {
    id: t.id,
    date: t.date,
    time: t.time,
    type: t.type,
    category: t.category,
    subcategory: t.subcategory,
    content: t.content,
    amount: t.amount,
    currency: t.currency,
    payment_method: t.paymentMethod,
    memo: t.memo,
    flow_type: t.flowType,
    flow_type_override: t.flowTypeOverride,
    transfer_pair_id: t.transferPairId,
    is_paired_transfer: t.isPairedTransfer,
    is_unmatched_transfer: t.isUnmatchedTransfer,
  }
}

async function recomputeTransferPairing(transactions: Transaction[]): Promise<Map<string, Partial<Transaction>>> {
  const internal = transactions.filter((t) => t.type === '이체' && t.category === '내계좌이체')
  const candidates: TransferCandidate[] = internal.map((t) => ({
    id: t.id,
    amount: t.amount,
    paymentMethod: t.paymentMethod,
    dateTimeMinutes: dateTimeToMinutes(t.date, t.time),
  }))
  const { pairs, unmatchedIds } = matchTransferPairs(candidates)

  const patches = new Map<string, Partial<Transaction>>()
  for (const { a, b } of pairs) {
    patches.set(a, { transferPairId: `${a}:${b}`, isPairedTransfer: true, isUnmatchedTransfer: false })
    patches.set(b, { transferPairId: `${a}:${b}`, isPairedTransfer: true, isUnmatchedTransfer: false })
  }
  for (const id of unmatchedIds) {
    patches.set(id, { transferPairId: null, isPairedTransfer: false, isUnmatchedTransfer: true })
  }
  return patches
}

interface TransactionStoreState {
  transactions: Transaction[]
  rules: ClassificationRule[]
  loading: boolean
  fetchAll: () => Promise<void>
  importRows: (rows: ParsedRawRow[]) => Promise<{ inserted: number; duplicates: number }>
  updateTransaction: (id: string, patch: Partial<Transaction>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  setOverride: (id: string, override: 'saving' | 'spending' | null) => Promise<void>
  addRule: (rule: Omit<ClassificationRule, 'id'>) => Promise<void>
}

export const useTransactionStore = create<TransactionStoreState>((set, get) => ({
  transactions: [],
  rules: [],
  loading: false,

  async fetchAll() {
    set({ loading: true })
    const [{ data: txRows, error: txError }, { data: ruleRows, error: ruleError }] = await Promise.all([
      supabase.from('transactions').select('*'),
      supabase.from('classification_rules').select('*'),
    ])
    if (txError) throw txError
    if (ruleError) throw ruleError

    const rules: ClassificationRule[] = (ruleRows ?? []).map((r) => ({
      id: r.id,
      matchType: r.match_type,
      matchValue: r.match_value,
      flowType: r.flow_type,
    }))

    const transactions = (txRows ?? []).map(rowToTransaction)
    set({ transactions, rules, loading: false })
  },

  async importRows(rows) {
    const existingIds = new Set(get().transactions.map((t) => t.id))
    const rules = get().rules

    const withIds = await Promise.all(
      rows.map(async (row) => ({
        row,
        id: await computeTransactionId({
          date: row.date,
          time: row.time,
          type: row.type,
          category: row.category,
          subcategory: row.subcategory,
          content: row.content,
          amount: row.amount,
          paymentMethod: row.paymentMethod,
        }),
      }))
    )

    const newOnes = withIds.filter(({ id }) => !existingIds.has(id))
    const duplicates = withIds.length - newOnes.length

    const newTransactions: Transaction[] = newOnes.map(({ row, id }) => ({
      id,
      date: row.date,
      time: row.time,
      type: row.type,
      category: row.category,
      subcategory: row.subcategory,
      content: row.content,
      amount: row.amount,
      currency: row.currency,
      paymentMethod: row.paymentMethod,
      memo: row.memo,
      flowType: 'spending',
      flowTypeOverride: null,
      transferPairId: null,
      isPairedTransfer: false,
      isUnmatchedTransfer: false,
    }))

    const allTransactions = [...get().transactions, ...newTransactions]
    const pairingPatches = await recomputeTransferPairing(allTransactions)

    const finalized = allTransactions.map((t) => {
      const patch = pairingPatches.get(t.id) ?? {
        transferPairId: null,
        isPairedTransfer: false,
        isUnmatchedTransfer: false,
      }
      const merged = { ...t, ...patch }
      // `flowType` stores the AUTOMATIC classification only — pass flowTypeOverride: null here
      // even though the transaction may have one, so a later override removal still falls back
      // to a correct computed value (see aggregations.ts#resolvedFlowType, which applies the
      // override at read time). Only the `flowTypeOverride` column itself carries the override.
      merged.flowType = classifyFlowType(
        {
          type: merged.type,
          category: merged.category,
          subcategory: merged.subcategory,
          content: merged.content,
          paymentMethod: merged.paymentMethod,
          amount: merged.amount,
          isPairedTransfer: merged.isPairedTransfer,
          isUnmatchedTransfer: merged.isUnmatchedTransfer,
          flowTypeOverride: null,
        },
        rules
      )
      return merged
    })

    if (finalized.length > 0) {
      const { error } = await supabase.from('transactions').upsert(finalized.map(transactionToRow))
      if (error) throw error
    }

    set({ transactions: finalized })
    return { inserted: newOnes.length, duplicates }
  },

  async updateTransaction(id, patch) {
    const current = get().transactions.find((t) => t.id === id)
    if (!current) return
    const updated = { ...current, ...patch }
    const { error } = await supabase.from('transactions').update(transactionToRow(updated)).eq('id', id)
    if (error) throw error
    set({ transactions: get().transactions.map((t) => (t.id === id ? updated : t)) })
  },

  async deleteTransaction(id) {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) throw error
    set({ transactions: get().transactions.filter((t) => t.id !== id) })
  },

  async setOverride(id, override) {
    await get().updateTransaction(id, { flowTypeOverride: override })
  },

  async addRule(rule) {
    const { data, error } = await supabase
      .from('classification_rules')
      .insert({ match_type: rule.matchType, match_value: rule.matchValue, flow_type: rule.flowType })
      .select()
      .single()
    if (error) throw error
    set({
      rules: [...get().rules, { id: data.id, matchType: data.match_type, matchValue: data.match_value, flowType: data.flow_type }],
    })
  },
}))
