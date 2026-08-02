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
}: EntriesToolbarProps) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-4 flex gap-2">
        {ENTRY_SECTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSectionChange(s)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              section === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
            className="rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-800"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {isPartial && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
              일부 기간
            </span>
          )}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="내용/메모 검색"
          className="rounded-lg border px-3 py-1.5 text-sm"
        />

        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-sm"
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
          className="rounded-lg border px-3 py-1.5 text-sm"
        >
          <option value="ALL">전체 결제수단</option>
          {paymentMethodOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
