import { useEffect, useMemo, useState } from 'react'
import EntriesToolbar from '../components/entries/EntriesToolbar'
import EntriesTable, { type EntryColumnDef } from '../components/entries/EntriesTable'
import { useTransactionStore } from '../store/useTransactionStore'
import { listAvailableMonths } from '../lib/aggregations'
import {
  applyEntryFieldPatch,
  currentMonthKey,
  defaultDateForMonth,
  filterByMonth,
  filterBySection,
  filterExcluded,
  isPartialMonth,
  searchEntries,
  sortEntries,
  type EntryColumnKey,
  type EntrySection,
  type SortDirection,
  type SortField,
} from '../lib/entriesLogic'
import { computeTransactionId } from '../lib/idHash'
import {
  SEED_EXPENSE_CATEGORIES,
  SEED_INCOME_CATEGORIES,
  SEED_PAYMENT_METHODS,
  mergeObservedCategories,
  mergeObservedFlatList,
  mergeObservedPaymentMethods,
} from '../lib/categories'
import type { Transaction } from '../types/transaction'

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function createDraft(section: EntrySection, month: string): Transaction {
  return {
    id: '__draft__',
    date: defaultDateForMonth(month, new Date()),
    time: '12:00:00',
    type: section === 'income' ? '수입' : '지출',
    category: section === 'income' ? SEED_INCOME_CATEGORIES[0] : Object.keys(SEED_EXPENSE_CATEGORIES)[0],
    subcategory: '미분류',
    content: '',
    amount: 0,
    currency: 'KRW',
    paymentMethod: SEED_PAYMENT_METHODS[0],
    memo: null,
    flowType: section,
    flowTypeOverride: null,
    transferPairId: null,
    isPairedTransfer: false,
    isUnmatchedTransfer: false,
  }
}

export default function EntriesPage() {
  const transactions = useTransactionStore((s) => s.transactions)
  const updateTransaction = useTransactionStore((s) => s.updateTransaction)
  const deleteTransaction = useTransactionStore((s) => s.deleteTransaction)
  const addTransaction = useTransactionStore((s) => s.addTransaction)
  const setOverride = useTransactionStore((s) => s.setOverride)

  const [section, setSection] = useState<EntrySection>('spending')
  const availableMonths = useMemo(() => listAvailableMonths(transactions), [transactions])
  const [month, setMonth] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [draft, setDraft] = useState<Transaction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showExcluded, setShowExcluded] = useState(false)
  // True while `month` holds the "no data at all yet" fallback (the current real month) rather than
  // a month derived from actual data — lets us re-sync once transactions finish loading.
  const [monthIsFallback, setMonthIsFallback] = useState(false)

  useEffect(() => {
    if (availableMonths.length === 0) {
      // Empty database: fall back to the current real month so a brand-new user still gets a
      // toolbar, an empty table and a working "+ 추가" button instead of a dead-end message.
      if (!month) {
        setMonth(currentMonthKey(new Date()))
        setMonthIsFallback(true)
      }
      return
    }
    if (!month || monthIsFallback) {
      setMonth(availableMonths[availableMonths.length - 1])
      setMonthIsFallback(false)
    }
  }, [availableMonths, month, monthIsFallback])

  // The month dropdown must always contain the selected month, including the empty-database fallback.
  const monthOptions = useMemo(
    () => (!month || availableMonths.includes(month) ? availableMonths : [...availableMonths, month].sort()),
    [availableMonths, month]
  )
  // Dropdown displays most recent month first; monthOptions itself stays ascending for the fallback-insertion logic above.
  const monthOptionsDesc = useMemo(() => [...monthOptions].reverse(), [monthOptions])

  // Section switches also reset the filter dropdowns, whose option lists are section-specific.
  useEffect(() => {
    setCategoryFilter('ALL')
    setPaymentMethodFilter('ALL')
  }, [section])

  // Any change to what is on screen clears the selection and the open draft, so bulk actions can
  // never target rows the user can no longer see.
  useEffect(() => {
    setSelectedIds(new Set())
    setDraft(null)
  }, [section, month, categoryFilter, paymentMethodFilter, search, showExcluded])

  const excludedRows = useMemo(() => filterExcluded(transactions), [transactions])
  const baseRows = useMemo(
    () => (showExcluded ? excludedRows : filterBySection(transactions, section)),
    [showExcluded, excludedRows, transactions, section]
  )
  const monthRows = useMemo(() => filterByMonth(baseRows, month), [baseRows, month])
  const categoryFiltered = useMemo(
    () => (categoryFilter === 'ALL' ? monthRows : monthRows.filter((t) => t.category === categoryFilter)),
    [monthRows, categoryFilter]
  )
  const paymentFiltered = useMemo(
    () =>
      paymentMethodFilter === 'ALL'
        ? categoryFiltered
        : categoryFiltered.filter((t) => t.paymentMethod === paymentMethodFilter),
    [categoryFiltered, paymentMethodFilter]
  )
  const searched = useMemo(() => searchEntries(paymentFiltered, search), [paymentFiltered, search])
  const sortedRows = useMemo(
    () => sortEntries(searched, sortField, sortDirection),
    [searched, sortField, sortDirection]
  )
  const totalAmount = useMemo(() => sortedRows.reduce((sum, t) => sum + t.amount, 0), [sortedRows])

  const sectionRowsForFilters = useMemo(
    () => (showExcluded ? excludedRows : filterBySection(transactions, section)),
    [showExcluded, excludedRows, transactions, section]
  )
  const categoryFilterOptions = useMemo(
    () => [...new Set(sectionRowsForFilters.map((t) => t.category))].sort(),
    [sectionRowsForFilters]
  )
  const paymentMethodFilterOptions = useMemo(
    () => [...new Set(sectionRowsForFilters.map((t) => t.paymentMethod))].sort(),
    [sectionRowsForFilters]
  )

  const paymentMethodOptions = useMemo(
    () => mergeObservedPaymentMethods(transactions.map((t) => t.paymentMethod)),
    [transactions]
  )
  const incomeCategoryOptions = useMemo(
    () =>
      mergeObservedFlatList(SEED_INCOME_CATEGORIES, filterBySection(transactions, 'income').map((t) => t.category)),
    [transactions]
  )
  const expenseCategories = useMemo(
    () =>
      mergeObservedCategories(
        SEED_EXPENSE_CATEGORIES,
        filterBySection(transactions, 'spending').map((t) => ({ category: t.category, subcategory: t.subcategory }))
      ),
    [transactions]
  )

  const columns: EntryColumnDef[] = useMemo(() => {
    if (section === 'income') {
      return [
        { key: 'date', label: '날짜', type: 'date' },
        { key: 'paymentMethod', label: '입금수단', type: 'select', options: paymentMethodOptions },
        { key: 'category', label: '대분류', type: 'select', options: incomeCategoryOptions },
        { key: 'content', label: '내용', type: 'text' },
        { key: 'amount', label: '금액', type: 'amount' },
      ]
    }
    return [
      { key: 'date', label: '날짜', type: 'date' },
      { key: 'paymentMethod', label: '결제수단', type: 'select', options: paymentMethodOptions },
      { key: 'category', label: '대분류', type: 'select', options: Object.keys(expenseCategories) },
      {
        key: 'subcategory',
        label: '소분류',
        type: 'select',
        options: (row: Transaction) => expenseCategories[row.category] ?? [],
      },
      { key: 'content', label: '지출내용', type: 'text' },
      { key: 'amount', label: '금액', type: 'amount' },
    ]
  }, [section, paymentMethodOptions, incomeCategoryOptions, expenseCategories])

  async function handleSetOverride(id: string, override: 'spending' | 'neutral' | null) {
    try {
      await setOverride(id, override)
      setError(null)
    } catch (err) {
      setError(`분류 변경에 실패했습니다: ${errorText(err)}`)
    }
  }

  // Normal view: offer "이체로 제외" on every row (both tabs) — the user manually flags a
  // mistakenly-typed internal transfer. Excluded view: offer "복구" instead, clearing the override.
  const overrideAction = showExcluded
    ? {
        label: () => '복구',
        onClick: (row: Transaction) => handleSetOverride(row.id, null),
      }
    : {
        label: () => '이체로 제외',
        onClick: (row: Transaction) => handleSetOverride(row.id, 'neutral'),
      }

  async function handleEditField(id: string, key: EntryColumnKey, value: string | number) {
    // Preserve the row's existing sign when editing an amount: a positive `spending` row is a refund,
    // and forcing the section's default sign would silently turn it into a charge.
    const currentAmount = key === 'amount' ? transactions.find((t) => t.id === id)?.amount : undefined
    try {
      await updateTransaction(id, applyEntryFieldPatch(section, key, value, currentAmount))
      setError(null)
    } catch (err) {
      setError(`저장에 실패했습니다: ${errorText(err)}`)
    }
  }

  function handleDraftChange(key: EntryColumnKey, value: string | number) {
    setDraft((prev) => (prev ? { ...prev, ...applyEntryFieldPatch(section, key, value) } : prev))
  }

  async function handleDraftSave() {
    if (!draft) return
    if (!draft.content.trim() || draft.amount === 0) return
    const id = await computeTransactionId({
      date: draft.date,
      time: draft.time,
      type: draft.type,
      category: draft.category,
      subcategory: draft.subcategory,
      content: draft.content,
      amount: draft.amount,
      paymentMethod: draft.paymentMethod,
    })
    try {
      await addTransaction({ ...draft, id })
      setDraft(null)
      setError(null)
    } catch (err) {
      setError(`저장에 실패했습니다: ${errorText(err)}`)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === sortedRows.length ? new Set() : new Set(sortedRows.map((t) => t.id))))
  }

  async function handleBulkDelete() {
    // Belt-and-suspenders: only ever delete rows that are actually on screen right now, even if some
    // future filter path forgets to clear the selection.
    const visibleIds = new Set(sortedRows.map((t) => t.id))
    const ids = [...selectedIds].filter((id) => visibleIds.has(id))
    if (ids.length === 0) {
      setSelectedIds(new Set())
      return
    }
    if (!window.confirm(`선택한 ${ids.length}건을 삭제하시겠습니까?`)) return

    const results = await Promise.allSettled(ids.map((id) => deleteTransaction(id)))
    setSelectedIds(new Set())
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) {
      setError(`삭제에 실패했습니다: ${ids.length}건 중 ${ids.length - failed}건 삭제, ${failed}건 실패했습니다.`)
    } else {
      setError(null)
    }
  }

  async function handleDeleteRow(id: string) {
    if (!window.confirm('이 항목을 삭제하시겠습니까?')) return
    try {
      await deleteTransaction(id)
      setError(null)
    } catch (err) {
      setError(`삭제에 실패했습니다: ${errorText(err)}`)
    }
  }

  function handleSortChange(field: SortField) {
    if (field === sortField) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  if (!month) {
    return (
      <div className="rounded-xl bg-white p-6 text-slate-500 shadow-sm">
        불러온 데이터가 없습니다. 먼저 데이터를 불러와주세요.
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-800">거래 입력/관리</h1>

      {error && (
        <div className="mb-4 flex items-start justify-between gap-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 font-medium hover:underline">
            닫기
          </button>
        </div>
      )}

      <EntriesToolbar
        section={section}
        onSectionChange={setSection}
        month={month}
        availableMonths={monthOptionsDesc}
        isPartial={isPartialMonth(transactions, month)}
        onMonthChange={setMonth}
        search={search}
        onSearchChange={setSearch}
        categoryFilter={categoryFilter}
        categoryOptions={categoryFilterOptions}
        onCategoryFilterChange={setCategoryFilter}
        paymentMethodFilter={paymentMethodFilter}
        paymentMethodOptions={paymentMethodFilterOptions}
        onPaymentMethodFilterChange={setPaymentMethodFilter}
        showExcluded={showExcluded}
        excludedCount={excludedRows.length}
        onToggleShowExcluded={() => setShowExcluded((v) => !v)}
      />

      <div className="mt-4">
        <EntriesTable
          columns={columns}
          rows={sortedRows}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onBulkDelete={handleBulkDelete}
          onDeleteRow={handleDeleteRow}
          onEditField={handleEditField}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          totalAmount={totalAmount}
          draftRow={draft}
          onDraftChange={handleDraftChange}
          onDraftSave={handleDraftSave}
          onDraftCancel={() => setDraft(null)}
          onStartDraft={() => setDraft(createDraft(section, month))}
          overrideAction={overrideAction}
        />
      </div>
    </div>
  )
}
