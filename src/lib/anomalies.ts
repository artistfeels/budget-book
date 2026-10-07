import type { Transaction } from '../types/transaction'
import { listAvailableMonths, resolvedFlowType } from './aggregations'

// "평소와 다른" 지출을 잡아내는 두 가지 신호.
// 1) 카테고리 단위: 이번 달 카테고리 지출이 그 카테고리의 과거 월별 분포에서 크게 벗어났는가
// 2) 거래 단위: 한 건이 그 카테고리의 평소 결제 금액보다 훨씬 큰가
// 평균·표준편차 대신 중앙값·MAD를 쓴다 — 한두 번의 큰 지출(이사, 여행)이 기준선을 끌어올려
// 정작 다음 이상치를 놓치는 일을 막기 위해서다.

const HISTORY_MONTHS = 6
const MIN_HISTORY_MONTHS = 3
/** MAD를 정규분포 표준편차 척도로 맞추는 상수 */
const MAD_SCALE = 1.4826
const Z_THRESHOLD = 3
/** 이 금액 미만의 증가는 이상치로 보지 않는다 (커피 몇 잔 차이로 경고가 뜨지 않도록) */
const MIN_CATEGORY_DIFF = 50_000
const MIN_TX_AMOUNT = 100_000
const TX_MULTIPLE = 4
const MIN_TX_SAMPLES = 5

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function isSpending(t: Transaction): boolean {
  return resolvedFlowType(t) === 'spending'
}

export interface CategoryAnomaly {
  category: string
  currentAmount: number
  /** 과거 월별 지출의 중앙값 */
  typicalAmount: number
  /** current / typical (typical이 0이면 null) */
  ratio: number | null
}

export function detectCategoryAnomalies(transactions: Transaction[], month: string): CategoryAnomaly[] {
  const history = listAvailableMonths(transactions)
    .filter((m) => m < month)
    .slice(-HISTORY_MONTHS)
  if (history.length < MIN_HISTORY_MONTHS) return []

  // category -> month -> signed sum (지출은 음수, 환불은 양수로 상계)
  const sums = new Map<string, Map<string, number>>()
  for (const t of transactions) {
    if (!isSpending(t)) continue
    const m = t.date.slice(0, 7)
    if (m !== month && !history.includes(m)) continue
    if (!sums.has(t.category)) sums.set(t.category, new Map())
    const perMonth = sums.get(t.category)!
    perMonth.set(m, (perMonth.get(m) ?? 0) + t.amount)
  }

  const spentIn = (perMonth: Map<string, number>, m: string) => Math.max(0, -(perMonth.get(m) ?? 0))

  const result: CategoryAnomaly[] = []
  for (const [category, perMonth] of sums) {
    const current = spentIn(perMonth, month)
    if (current === 0) continue
    // 지출이 없던 달은 0으로 친다 — "가끔만 쓰던 카테고리에 큰 돈이 나갔다"도 이상치다
    const past = history.map((m) => spentIn(perMonth, m))
    const typical = median(past)
    const mad = median(past.map((v) => Math.abs(v - typical))) * MAD_SCALE
    const threshold = mad > 0 ? typical + Z_THRESHOLD * mad : typical * 1.5
    if (current > threshold && current - typical >= MIN_CATEGORY_DIFF) {
      result.push({ category, currentAmount: current, typicalAmount: Math.round(typical), ratio: typical > 0 ? current / typical : null })
    }
  }
  return result.sort((a, b) => b.currentAmount - b.typicalAmount - (a.currentAmount - a.typicalAmount))
}

export interface TransactionAnomaly {
  transaction: Transaction
  amount: number
  /** 해당 카테고리 과거 결제 1건의 중앙값 */
  typicalAmount: number
  ratio: number
}

export function detectLargeTransactions(transactions: Transaction[], month: string, limit = 5): TransactionAnomaly[] {
  const pastByCategory = new Map<string, number[]>()
  for (const t of transactions) {
    if (!isSpending(t) || t.amount >= 0 || t.date.slice(0, 7) >= month) continue
    const list = pastByCategory.get(t.category) ?? []
    list.push(-t.amount)
    pastByCategory.set(t.category, list)
  }
  const typicalByCategory = new Map<string, number>()
  for (const [category, amounts] of pastByCategory) {
    if (amounts.length >= MIN_TX_SAMPLES) typicalByCategory.set(category, median(amounts))
  }

  const result: TransactionAnomaly[] = []
  for (const t of transactions) {
    if (!isSpending(t) || t.amount >= 0 || t.date.slice(0, 7) !== month) continue
    const amount = -t.amount
    const typical = typicalByCategory.get(t.category)
    if (typical === undefined || typical <= 0) continue
    if (amount >= MIN_TX_AMOUNT && amount >= typical * TX_MULTIPLE) {
      result.push({ transaction: t, amount, typicalAmount: Math.round(typical), ratio: amount / typical })
    }
  }
  return result.sort((a, b) => b.amount - a.amount).slice(0, limit)
}
