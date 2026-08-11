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
    <div className="card animate-fade-up p-4">
      <div className="mb-4 -mx-1 overflow-x-auto px-1">
        <div className="segmented">
          {ENTRY_SECTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onSectionChange(s)}
              aria-pressed={section === s}
              className={`btn-ghost ${section === s ? 'btn-ghost-active' : ''}`}
            >
              {ENTRY_SECTION_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:flex md:flex-wrap md:items-center">
        <div className="col-span-2 flex items-center gap-2 md:col-span-1">
          <select
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="field w-full font-medium md:w-auto"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {isPartial && (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              일부 기간
            </span>
          )}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="내용/메모 검색"
          className="field w-full md:w-auto"
        />

        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
          className="field w-full md:w-auto"
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
          className="field w-full md:w-auto"
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
          aria-pressed={showExcluded}
          className={`w-full rounded-lg border px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-spring active:scale-[0.97] md:w-auto ${
            showExcluded
              ? 'border-accent/40 bg-accent/10 text-accent dark:border-accent-light/40 dark:bg-accent-light/10 dark:text-accent-light'
              : 'border-black/[0.08] text-slate-500 hover:bg-black/[0.03] dark:border-white/[0.1] dark:text-slate-400 dark:hover:bg-white/[0.05]'
          }`}
        >
          제외됨 ({excludedCount})
        </button>
      </div>
    </div>
  )
}
