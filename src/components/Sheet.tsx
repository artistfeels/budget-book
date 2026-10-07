import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDialog } from '../lib/useDialog'
import CloseButton from './CloseButton'

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
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialog(dialogRef, onClose)

  // Portalled to <body> because `position: fixed` resolves against the nearest transformed
  // ancestor, not the viewport — and every .card in this app carries `animate-fade-up`, whose
  // `both` fill mode leaves a transform on the element forever. Rendering in place would anchor
  // the sheet to the middle of the card instead of the bottom of the screen.
  return createPortal(
    <>
      <div
        className="animate-fade-in fixed inset-0 z-30 bg-black/20 backdrop-blur-[2px] dark:bg-black/50"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="animate-slide-up fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-black/[0.06] bg-surface-light shadow-2xl dark:border-white/[0.07] dark:bg-surface-dark"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/[0.06] px-5 py-2.5 dark:border-white/[0.07]">
          <p className="text-lg font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">{title}</p>
          <CloseButton onClick={onClose} />
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
    </>,
    document.body
  )
}
