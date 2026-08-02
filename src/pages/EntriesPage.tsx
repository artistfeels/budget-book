import { useEffect, useMemo, useState } from 'react'
import EntriesToolbar from '../components/entries/EntriesToolbar'
import EntriesTable, { type EntryColumnDef } from '../components/entries/EntriesTable'
import { useTransactionStore } from '../store/useTransactionStore'
import { listAvailableMonths } from '../lib/aggregations'
import {
  applyEntryFieldPatch,
  defaultDateForMonth,
  filterByMonth,
  filterBySection,
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
  SEED_SAVING_CATEGORIES,
  mergeObservedCategories,
  mergeObservedFlatList,
  mergeObservedPaymentMethods,
} from '../lib/categories'
import type { Transaction } from '../types/transaction'

function createDraft(section: EntrySection, month: string): Transaction {
  return {
    id: '__draft__',
    date: defaultDateForMonth(month, new Date()),
    time: '12:00:00',
    type: section === 'income' ? '수입' : section === 'saving' ? '이체' : '지출',
    category:
      section === 'income'
        ? SEED_INCOME_CATEGORIES[0]
        : section === 'saving'
          ? SEED_SAVING_CATEGORIES[0]
          : Object.keys(SEED_EXPENSE_CATEGORIES)[0],
    subcategory: '미분류',
    content: '',
    amount: 0,
    currency: 'KRW',
    paymentMethod: SEED_PAYMENT_METHODS[0],
    memo: null,
    flowType: section,
    flowTypeOverride: section === 'income' ? null : section,
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

  useEffect(() => {
    if (!month && availableMonths.length > 0) {
      setMonth(availableMonths[availableMonths.length - 1])
    }
  }, [availableMonths, month])

  useEffect(() => {
    setCategoryFilter('ALL')
    setPaymentMethodFilter('ALL')
    setSelectedIds(new Set())
    setDraft(null)
  }, [section])

  const sectionRows = useMemo(() => filterBySection(transactions, section), [transactions, section])
  const monthRows = useMemo(() => filterByMonth(sectionRows, month), [sectionRows, month])
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

  const categoryFilterOptions = useMemo(() => [...new Set(sectionRows.map((t) => t.category))].sort(), [sectionRows])
  const paymentMethodFilterOptions = useMemo(
    () => [...new Set(sectionRows.map((t) => t.paymentMethod))].sort(),
    [sectionRows]
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
  const savingCategoryOptions = useMemo(
    () =>
      mergeObservedFlatList(SEED_SAVING_CATEGORIES, filterBySection(transactions, 'saving').map((t) => t.category)),
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
    if (section === 'saving') {
      return [
        { key: 'date', label: '날짜', type: 'date' },
        { key: 'paymentMethod', label: '계좌', type: 'select', options: paymentMethodOptions },
        { key: 'category', label: '구분', type: 'select', options: savingCategoryOptions },
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
  }, [section, paymentMethodOptions, incomeCategoryOptions, savingCategoryOptions, expenseCategories])

  const overrideAction =
    section === 'spending'
      ? {
          label: (row: Transaction) => (row.flowTypeOverride === 'spending' ? '자동 분류로' : '저축으로 전환'),
          onClick: (row: Transaction) => setOverride(row.id, row.flowTypeOverride === 'spending' ? null : 'saving'),
        }
      : section === 'saving'
        ? {
            label: (row: Transaction) => (row.flowTypeOverride === 'saving' ? '자동 분류로' : '지출로 전환'),
            onClick: (row: Transaction) => setOverride(row.id, row.flowTypeOverride === 'saving' ? null : 'spending'),
          }
        : undefined

  function handleEditField(id: string, key: EntryColumnKey, value: string | number) {
    updateTransaction(id, applyEntryFieldPatch(section, key, value))
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
    await addTransaction({ ...draft, id })
    setDraft(null)
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
    await Promise.all([...selectedIds].map((id) => deleteTransaction(id)))
    setSelectedIds(new Set())
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

      <EntriesToolbar
        section={section}
        onSectionChange={setSection}
        month={month}
        availableMonths={availableMonths}
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
      />

      <div className="mt-4">
        <EntriesTable
          columns={columns}
          rows={sortedRows}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onBulkDelete={handleBulkDelete}
          onDeleteRow={deleteTransaction}
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
