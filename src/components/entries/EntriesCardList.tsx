import { useState } from 'react'
import { formatKRW } from '../../lib/format'
import type { SortField } from '../../lib/entriesLogic'
import type { Transaction } from '../../types/transaction'
import type { EntryListProps } from './EntriesTable'
import EntryEditSheet from './EntryEditSheet'

const SORT_FIELDS: { field: SortField; label: string }[] = [
  { field: 'date', label: '날짜' },
  { field: 'amount', label: '금액' },
]

export default function EntriesCardList({
  columns,
  rows,
  selectedIds,
  onToggleSelect,
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
}: EntryListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const editingRow = editingId ? rows.find((r) => r.id === editingId) : undefined

  // A row that vanishes from the filtered list while its sheet is open (e.g. an edit moved it out
  // of the current month) would otherwise leave the sheet stuck on stale data. Adjusting state
  // during render is the documented pattern for this; it converges on the immediate re-render.
  if (editingId && !editingRow) setEditingId(null)

  return (
    <div className="card animate-fade-up p-4">
      <div className="mb-4 flex items-baseline justify-between border-b border-black/[0.06] pb-4 dark:border-white/[0.07]">
        <span className="text-sm text-slate-500 dark:text-slate-400">합계 ({rows.length}건)</span>
        <span className="text-xl font-semibold tabular-nums tracking-[-0.02em] text-slate-900 dark:text-white">
          {formatKRW(totalAmount)}
        </span>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="segmented">
          {SORT_FIELDS.map(({ field, label }) => (
            <button
              key={field}
              onClick={() => onSortChange(field)}
              aria-pressed={sortField === field}
              className={`btn-ghost text-xs ${sortField === field ? 'btn-ghost-active' : ''}`}
            >
              {label} {sortField === field ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
            </button>
          ))}
        </div>
        <button
          onClick={onBulkDelete}
          disabled={selectedIds.size === 0}
          className="shrink-0 rounded-full bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-600 transition-all duration-200 ease-spring active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 dark:text-rose-400"
        >
          선택 삭제 ({selectedIds.size})
        </button>
      </div>

      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-center gap-3 rounded-xl border border-black/[0.06] px-3 py-2.5 dark:border-white/[0.07]"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(row.id)}
              onChange={() => onToggleSelect(row.id)}
              aria-label={`${row.content} 선택`}
              className="h-4 w-4 shrink-0"
            />
            <button onClick={() => setEditingId(row.id)} className="min-w-0 flex-1 text-left">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                  {row.content || '(내용 없음)'}
                </span>
                <span className="shrink-0 font-medium tabular-nums text-slate-900 dark:text-white">
                  {formatKRW(row.amount)}
                </span>
              </div>
              <div className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">
                {row.date} · {row.category} · {row.paymentMethod}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {rows.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">표시할 거래가 없습니다.</p>
      )}

      <button
        onClick={onStartDraft}
        className="mt-4 w-full rounded-xl border border-dashed border-black/[0.12] py-3 text-sm text-slate-500 transition-all duration-200 ease-spring active:scale-[0.99] dark:border-white/[0.12] dark:text-slate-400"
      >
        + 추가
      </button>

      {draftRow && (
        <EntryEditSheet
          columns={columns}
          row={draftRow}
          isDraft
          onChange={onDraftChange}
          onClose={onDraftCancel}
          onSave={onDraftSave}
          onDelete={onDraftCancel}
        />
      )}

      {editingRow && (
        <EntryEditSheet
          columns={columns}
          row={editingRow}
          isDraft={false}
          onChange={(key, value) => onEditField(editingRow.id, key, value)}
          onClose={() => setEditingId(null)}
          onSave={() => setEditingId(null)}
          onDelete={() => {
            setEditingId(null)
            onDeleteRow(editingRow.id)
          }}
          overrideAction={
            overrideAction && {
              label: overrideAction.label,
              onClick: (r: Transaction) => {
                setEditingId(null)
                overrideAction.onClick(r)
              },
            }
          }
        />
      )}
    </div>
  )
}
