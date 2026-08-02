import { useState } from 'react'

const CUSTOM_OPTION = '__custom__'

interface EditableSelectProps {
  value: string
  options: string[]
  onChange: (value: string) => void
  className?: string
}

export default function EditableSelect({ value, options, onChange, className }: EditableSelectProps) {
  const [customMode, setCustomMode] = useState(false)
  const [draft, setDraft] = useState(value)

  const allOptions = value && !options.includes(value) ? [value, ...options] : options

  function commitCustom() {
    setCustomMode(false)
    const trimmed = draft.trim()
    if (trimmed) onChange(trimmed)
  }

  if (customMode) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitCustom}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitCustom()
          if (e.key === 'Escape') setCustomMode(false)
        }}
        className={className ?? 'w-full rounded border px-2 py-1 text-sm'}
      />
    )
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === CUSTOM_OPTION) {
          setDraft(value)
          setCustomMode(true)
          return
        }
        onChange(e.target.value)
      }}
      className={className ?? 'w-full rounded border px-2 py-1 text-sm'}
    >
      {!value && <option value="">선택</option>}
      {allOptions.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
      <option value={CUSTOM_OPTION}>+ 직접 입력</option>
    </select>
  )
}
