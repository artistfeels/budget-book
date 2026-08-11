import { useEffect, type ReactNode } from 'react'

interface SheetProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** Pinned below the scrolling body so actions stay reachable in a long form. */
  footer?: ReactNode
}

/**
 * Bottom sheet used for anything that needs a form or a detail list on a phone. Capped at 85vh so
 * the page behind stays partly visible — a full-height panel reads as a route change rather than a
 * temporary overlay, and the user loses track of where they were.
 */
export default function Sheet({ title, onClose, children, footer }: SheetProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    // Locking the body prevents the page underneath from scrolling when the sheet's own content
    // reaches its end — otherwise a flick inside the sheet drags the whole app.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <>
      <div
        className="animate-fade-in fixed inset-0 z-30 bg-black/20 backdrop-blur-[2px] dark:bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-slide-up fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-black/[0.06] bg-surface-light shadow-2xl dark:border-white/[0.07] dark:bg-surface-dark"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.07]">
          <p className="text-lg font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">{title}</p>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-all duration-200 ease-spring hover:bg-black/[0.05] hover:text-slate-700 active:scale-90 dark:text-slate-500 dark:hover:bg-white/[0.08] dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div
            className="shrink-0 border-t border-black/[0.06] px-5 py-3 dark:border-white/[0.07]"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
