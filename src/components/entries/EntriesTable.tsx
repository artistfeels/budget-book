import type { Transaction } from '../../types/transaction'
import { formatKRW } from '../../lib/format'
import type { EntryColumnKey, SortDirection, SortField } from '../../lib/entriesLogic'
import EditableSelect from './EditableSelect'
import AmountInput from './AmountInput'

export interface EntryColumnDef {
  key: EntryColumnKey
  label: string
  type: 'date' | 'text' | 'select' | 'amount'
  options?: string[] | ((row: Transaction) => string[])
}

interface EntriesTableProps {
  columns: EntryColumnDef[]
  rows: Transaction[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onBulkDelete: () => void
  onDeleteRow: (id: string) => void
  onEditField: (id: string, key: EntryColumnKey, value: string | number) => void
  sortField: SortField
  sortDirection: SortDirection
  onSortChange: (field: SortField) => void
  totalAmount: number
  draftRow: Transaction | null
  onDraftChange: (key: EntryColumnKey, value: string | number) => void
  onDraftSave: () => void
  onDraftCancel: () => void
  onStartDraft: () => void
  overrideAction?: { label: (row: Transaction) => string; onClick: (row: Transaction) => void }
}

function resolveOptions(col: EntryColumnDef, row: Transaction): string[] {
  if (typeof col.options === 'function') return col.options(row)
  return col.options ?? []
}

function EditableCell({
  col,
  row,
  onChange,
}: {
  col: EntryColumnDef
  row: Transaction
  onChange: (key: EntryColumnKey, value: string | number) => void
}) {
  if (col.type === 'date') {
    return (
      <input
        type="date"
        value={row.date}
        onChange={(e) => onChange('date', e.target.value)}
        className="field w-full px-2 py-1"
      />
    )
  }
  if (col.type === 'text') {
    return (
      <input
        type="text"
        value={row.content}
        onChange={(e) => onChange('content', e.target.value)}
        className="field w-full px-2 py-1"
      />
    )
  }
  if (col.type === 'select') {
    return (
      <EditableSelect
        value={row[col.key] as string}
        options={resolveOptions(col, row)}
        onChange={(value) => onChange(col.key, value)}
      />
    )
  }
  return <AmountInput value={Math.abs(row.amount)} onChange={(value) => onChange('amount', value)} />
}

export default function EntriesTable({
  columns,
  rows,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onBulkDelete,
  onDeleteRow,
  onEditField,
  sortField,
  sortDirection,
  onSortChange,
  totalAmount,
  draftRow,
  onDraftChange,
  onDraftSave,
  onDraftCancel,
  onStartDraft,
  overrideAction,
}: EntriesTableProps) {
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id))

  return (
    <div className="overflow-x-auto card animate-fade-up p-6">
      <div className="mb-4 flex items-baseline justify-between border-b border-black/[0.06] pb-4 dark:border-white/[0.07]">
        <span className="text-sm text-slate-500 dark:text-slate-400">합계 ({rows.length}건)</span>
        <span className="text-xl font-semibold tabular-nums tracking-[-0.02em] text-slate-900 dark:text-white">
          {formatKRW(totalAmount)}
        </span>
      </div>
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={onBulkDelete}
          disabled={selectedIds.size === 0}
          className="rounded-full bg-rose-500/10 px-4 py-1.5 text-sm font-medium text-rose-600 transition-all duration-200 ease-spring hover:bg-rose-500/20 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 dark:text-rose-400"
        >
          선택 삭제 ({selectedIds.size})
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/[0.06] text-left text-slate-500 dark:border-white/[0.07] dark:text-slate-400">
            <th className="w-8 pb-2">
              <input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} />
            </th>
            {columns.map((col) => (
              <th key={col.key} className="pb-2 pr-4">
                {col.type === 'date' || col.type === 'amount' ? (
                  <button
                    onClick={() => onSortChange(col.key as SortField)}
                    className="font-medium hover:text-slate-800 dark:hover:text-slate-100"
                  >
                    {col.label} {sortField === col.key ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
            <th className="w-24 pb-2">작업</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-black/[0.04] transition-colors duration-150 last:border-0 hover:bg-black/[0.02] dark:border-white/[0.05] dark:hover:bg-white/[0.03]"
            >
              <td className="py-1.5">
                <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => onToggleSelect(row.id)} />
              </td>
              {columns.map((col) => (
                <td key={col.key} className="py-1.5 pr-4">
                  <EditableCell col={col} row={row} onChange={(key, value) => onEditField(row.id, key, value)} />
                </td>
              ))}
              <td className="py-1.5">
                <div className="flex items-center gap-2">
                  {overrideAction && (
                    <button
                      onClick={() => overrideAction.onClick(row)}
                      className="text-xs text-slate-400 hover:text-accent dark:text-slate-500"
                    >
                      {overrideAction.label(row)}
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteRow(row.id)}
                    className="text-xs text-slate-400 hover:text-rose-600 dark:text-slate-500"
                  >
                    삭제
                  </button>
                </div>
              </td>
            </tr>
          ))}

          {draftRow && (
            <tr className="animate-fade-in border-b border-black/[0.04] bg-accent/[0.06] last:border-0 dark:border-white/[0.05] dark:bg-accent-light/[0.08]">
              <td className="py-1.5" />
              {columns.map((col) => (
                <td key={col.key} className="py-1.5 pr-4">
                  <EditableCell col={col} row={draftRow} onChange={onDraftChange} />
                </td>
              ))}
              <td className="py-1.5">
                <div className="flex items-center gap-2">
                  <button onClick={onDraftSave} className="text-xs font-medium text-accent">
                    저장
                  </button>
                  <button onClick={onDraftCancel} className="text-xs text-slate-400 dark:text-slate-500">
                    취소
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {!draftRow && (
        <button
          onClick={onStartDraft}
          className="mt-4 w-full rounded-xl border border-dashed border-black/[0.12] py-2.5 text-sm text-slate-500 transition-all duration-200 ease-spring hover:border-accent/40 hover:bg-accent/[0.04] hover:text-accent dark:border-white/[0.12] dark:text-slate-400 dark:hover:border-accent-light/40 dark:hover:bg-accent-light/[0.06] dark:hover:text-accent-light"
        >
          + 추가
        </button>
      )}
    </div>
  )
}
