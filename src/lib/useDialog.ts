import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal behavior shared by every overlay (bottom sheet, day drawer): Esc closes, Tab stays inside
 * the dialog, the page behind stops scrolling, and focus moves in on open and back to whatever
 * opened it on close — so keyboard and screen-reader users never land behind the overlay.
 */
export function useDialog(dialogRef: RefObject<HTMLElement>, onClose: () => void) {
  // Callers pass inline arrows; keeping the latest one in a ref lets the effect run once per open
  // instead of re-running (and yanking focus back to the first control) on every parent render.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusables = () => (dialog ? [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)] : [])

    ;(focusables()[0] ?? dialog)?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    // Locking the body prevents the page underneath from scrolling when the dialog's own content
    // reaches its end — otherwise a flick inside the sheet drags the whole app.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      opener?.focus()
    }
  }, [dialogRef])
}
