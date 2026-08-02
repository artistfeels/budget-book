import { describe, it, expect } from 'vitest'
import {
  SEED_EXPENSE_CATEGORIES,
  SEED_INCOME_CATEGORIES,
  SEED_PAYMENT_METHODS,
  mergeObservedCategories,
  mergeObservedFlatList,
  mergeObservedPaymentMethods,
} from './categories'

describe('mergeObservedPaymentMethods', () => {
  it('includes all seed methods', () => {
    const merged = mergeObservedPaymentMethods([])
    for (const method of SEED_PAYMENT_METHODS) {
      expect(merged).toContain(method)
    }
  })

  it('adds a new observed method not in the seed list', () => {
    const merged = mergeObservedPaymentMethods(['새로운 카드'])
    expect(merged).toContain('새로운 카드')
  })

  it('does not duplicate an observed method already in the seed list', () => {
    const merged = mergeObservedPaymentMethods(['삼성카드 taptap O'])
    expect(merged.filter((m) => m === '삼성카드 taptap O')).toHaveLength(1)
  })
})

describe('mergeObservedCategories', () => {
  it('adds a new subcategory under an existing category', () => {
    const merged = mergeObservedCategories(SEED_EXPENSE_CATEGORIES, [{ category: '식비', subcategory: '분식' }])
    expect(merged['식비']).toContain('분식')
  })

  it('creates a new category when an observed category is unknown', () => {
    const merged = mergeObservedCategories(SEED_EXPENSE_CATEGORIES, [{ category: '반려동물', subcategory: '사료' }])
    expect(merged['반려동물']).toEqual(['사료'])
  })

  it('does not duplicate an existing subcategory', () => {
    const merged = mergeObservedCategories(SEED_EXPENSE_CATEGORIES, [{ category: '식비', subcategory: '배달' }])
    expect(merged['식비'].filter((s) => s === '배달')).toHaveLength(1)
  })
})

describe('mergeObservedFlatList', () => {
  it('includes every seed value', () => {
    const merged = mergeObservedFlatList(SEED_INCOME_CATEGORIES, [])
    for (const category of SEED_INCOME_CATEGORIES) {
      expect(merged).toContain(category)
    }
  })

  it('adds a new observed value not in the seed list', () => {
    const merged = mergeObservedFlatList(SEED_INCOME_CATEGORIES, ['환급금'])
    expect(merged).toContain('환급금')
  })

  it('does not duplicate an observed value already in the seed list', () => {
    const merged = mergeObservedFlatList(SEED_INCOME_CATEGORIES, ['급여'])
    expect(merged.filter((c) => c === '급여')).toHaveLength(1)
  })
})
