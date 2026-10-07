import { useEffect, useId, useRef, useState } from 'react'
import { usePreferencesStore } from '../store/usePreferencesStore'

// 헤더의 톱니바퀴 → 작은 설정 패널. 지금은 "리포트 버튼 표시" 하나뿐이지만,
// 켜고 끌 수 있는 기능이 늘면 여기에 줄을 추가한다.
export default function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelId = useId()
  const showReportButton = usePreferencesStore((s) => s.showReportButton)
  const setShowReportButton = usePreferencesStore((s) => s.setShowReportButton)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="설정"
        aria-label="설정"
        aria-expanded={open}
        aria-controls={panelId}
        className={`btn-ghost px-2.5 py-1.5 ${open ? 'btn-ghost-active' : ''}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div
          id={panelId}
          className="card animate-fade-up absolute right-0 top-full z-20 mt-2 w-72 p-4"
        >
          <p className="card-title mb-3 text-sm">설정</p>
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
            <span>
              <span className="block text-sm text-slate-800 dark:text-slate-100">월간 리포트 버튼</span>
              <span className="block text-xs text-slate-400 dark:text-slate-500">월간 상세 화면에 엑셀 내보내기 버튼 표시</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={showReportButton}
              onChange={(e) => setShowReportButton(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative h-6 w-10 shrink-0 rounded-full bg-black/[0.12] transition-colors duration-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-200 peer-checked:bg-accent peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40 dark:bg-white/[0.15] dark:peer-checked:bg-accent-light"
            />
          </label>
        </div>
      )}
    </div>
  )
}
