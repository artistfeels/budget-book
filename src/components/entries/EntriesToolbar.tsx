import { ENTRY_SECTIONS, ENTRY_SECTION_LABELS, type EntrySection } from '../../lib/entriesLogic'

interface EntriesToolbarProps {
  section: EntrySection
  onSectionChange: (section: EntrySection) => void
  month: string
  availableMonths: string[]
  isPartial: boolean
  onMonthChange: (month: string) => void
  search: string
  onSearchChange: (value: string) => void
  categoryFilter: string
  categoryOptions: string[]
  onCategoryFilterChange: (value: string) => void
  paymentMethodFilter: string
  paymentMethodOptions: string[]
  onPaymentMethodFilterChange: (value: string) => void
  showExcluded: boolean
  excludedCount: number
  onToggleShowExcluded: () => void
}

export default function EntriesToolbar({
  section,
  onSectionChange,
  month,
  availableMonths,
  isPartial,
  onMonthChange,
  search,
  onSearchChange,
  categoryFilter,
  categoryOptions,
  onCategoryFilterChange,
  paymentMethodFilter,
  paymentMethodOptions,
  onPaymentMethodFilterChange,
  showExcluded,
  excludedCount,
  onToggleShowExcluded,
}: EntriesToolbarProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <div className="mb-4 flex gap-2">
        {ENTRY_SECTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSectionChange(s)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              section === s
                ? 'bg-accent text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {ENTRY_SECTION_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {isPartial && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              일부 기간
            </span>
          )}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="내용/메모 검색"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
        />

        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="ALL">전체 카테고리</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={paymentMethodFilter}
          onChange={(e) => onPaymentMethodFilterChange(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="ALL">전체 결제수단</option>
          {paymentMethodOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <button
          onClick={onToggleShowExcluded}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
            showExcluded
              ? 'border-slate-400 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          제외됨 ({excludedCount})
        </button>
      </div>
    </div>
  )
}
