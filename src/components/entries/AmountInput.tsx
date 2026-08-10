import { useState } from 'react'

interface AmountInputProps {
  value: number
  onChange: (value: number) => void
  className?: string
}

function toDigits(raw: string): number {
  const digitsOnly = raw.replace(/[^0-9]/g, '')
  return digitsOnly ? Number(digitsOnly) : 0
}

export default function AmountInput({ value, onChange, className }: AmountInputProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(value))
          setEditing(true)
        }}
        className={
          className ??
          'w-full rounded-lg px-2 py-1 text-right text-sm tabular-nums transition-colors duration-150 hover:bg-black/[0.04] dark:text-slate-100 dark:hover:bg-white/[0.06]'
        }
      >
        {value.toLocaleString('ko-KR')}
      </button>
    )
  }

  function commit() {
    setEditing(false)
    onChange(toDigits(draft))
  }

  return (
    <input
      autoFocus
      inputMode="numeric"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setEditing(false)
      }}
      className={
        className ?? 'field w-full px-2 py-1 text-right'
      }
    />
  )
}
