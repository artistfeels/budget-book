import Sheet from '../Sheet'
import { EditableCell, type EntryColumnDef } from './EntriesTable'
import type { EntryColumnKey } from '../../lib/entriesLogic'
import type { Transaction } from '../../types/transaction'

interface EntryEditSheetProps {
  columns: EntryColumnDef[]
  row: Transaction
  /** Draft mode holds an unsaved new row: changes are staged and committed by the footer's 저장. */
  isDraft: boolean
  onChange: (key: EntryColumnKey, value: string | number) => void
  onClose: () => void
  onSave: () => void
  onDelete: () => void
  overrideAction?: { label: (row: Transaction) => string; onClick: (row: Transaction) => void }
}

export default function EntryEditSheet({
  columns,
  row,
  isDraft,
  onChange,
  onClose,
  onSave,
  onDelete,
  overrideAction,
}: EntryEditSheetProps) {
  // Editing an existing row writes through on every field change, matching the desktop table — so
  // the footer only needs a close button. A draft has nothing to write through to yet.
  const footer = isDraft ? (
    <div className="flex gap-2">
      <button onClick={onClose} className="btn-ghost flex-1">
        취소
      </button>
      <button onClick={onSave} className="btn-primary flex-1">
        저장
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <button
        onClick={onDelete}
        className="rounded-full bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-600 transition-all duration-200 ease-spring active:scale-[0.97] dark:text-rose-400"
      >
        삭제
      </button>
      {overrideAction && (
        <button onClick={() => overrideAction.onClick(row)} className="btn-ghost">
          {overrideAction.label(row)}
        </button>
      )}
      <button onClick={onClose} className="btn-primary ml-auto">
        완료
      </button>
    </div>
  )

  return (
    <Sheet title={isDraft ? '거래 추가' : '거래 편집'} onClose={onClose} footer={footer}>
      <div className="space-y-4">
        {columns.map((col) => (
          <label key={col.key} className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-slate-500 dark:text-slate-400">
              {col.label}
            </span>
            <EditableCell col={col} row={row} onChange={onChange} />
          </label>
        ))}
      </div>
    </Sheet>
  )
}
