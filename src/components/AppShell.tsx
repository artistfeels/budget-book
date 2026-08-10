import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import BrandMark from './BrandMark'
import ThemeToggle from './ThemeToggle'

const navItems = [
  { to: '/', label: '대시보드', end: true },
  { to: '/monthly', label: '월간 상세', end: false },
  { to: '/entries', label: '거래 관리', end: false },
  { to: '/analytics', label: '분석', end: false },
  { to: '/import', label: '불러오기', end: false },
]

// Mirrors NavLink's own matching rules so the sliding pill and NavLink's `isActive` can never
// disagree about which item is selected.
function isActivePath(pathname: string, to: string, end: boolean): boolean {
  if (end) return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

export default function AppShell({ children }: { children: ReactNode }) {
  // Keying <main> on the pathname remounts it per route, which re-runs the children's entrance
  // animations — so navigating feels like the new page assembles rather than snapping in.
  const { pathname } = useLocation()

  const navRef = useRef<HTMLElement | null>(null)
  const itemRefs = useRef(new Map<string, HTMLAnchorElement>())
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)
  // Gates the transition off for the first measurement, so the pill doesn't visibly fly in from
  // the left edge on page load — it should only animate when moving between items.
  const [hasSettled, setHasSettled] = useState(false)

  const activeTo = navItems.find((item) => isActivePath(pathname, item.to, item.end))?.to

  const measure = useCallback(() => {
    const nav = navRef.current
    const el = activeTo ? itemRefs.current.get(activeTo) : undefined
    if (!nav || !el) {
      setIndicator(null)
      return
    }
    // Rect deltas rather than offsetLeft: unambiguous regardless of how the offsetParent chain
    // resolves, and the nav has no border so its border box and padding box share a left edge.
    const navBox = nav.getBoundingClientRect()
    const box = el.getBoundingClientRect()
    setIndicator({ left: box.left - navBox.left, width: box.width })
  }, [activeTo])

  useLayoutEffect(measure, [measure])

  useEffect(() => {
    if (!indicator || hasSettled) return
    const id = requestAnimationFrame(() => setHasSettled(true))
    return () => cancelAnimationFrame(id)
  }, [indicator, hasSettled])

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    // Label widths shift when the webfont finishes loading and when the header reflows; either
    // would otherwise strand the pill next to its item instead of under it.
    const observer = new ResizeObserver(measure)
    observer.observe(nav)
    document.fonts?.ready.then(measure).catch(() => {})
    return () => observer.disconnect()
  }, [measure])

  return (
    <div className="min-h-screen bg-canvas-light dark:bg-canvas-dark">
      <header className="glass sticky top-0 z-10 border-b">
        <div className="mx-auto flex max-w-[1800px] items-center gap-6 px-8 py-3.5">
          <span className="flex select-none items-center gap-2.5 text-[17px] font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">
            <BrandMark className="h-7 w-7" />
            가계부
          </span>

          <nav ref={navRef} className="segmented relative">
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-1 left-0 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-white/[0.14] ${
                hasSettled ? 'transition-[transform,width,opacity] duration-500 ease-spring' : ''
              } ${indicator ? 'opacity-100' : 'opacity-0'}`}
              style={
                indicator ? { transform: `translateX(${indicator.left}px)`, width: `${indicator.width}px` } : undefined
              }
            />
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                ref={(el) => {
                  if (el) itemRefs.current.set(item.to, el)
                  else itemRefs.current.delete(item.to)
                }}
                className={({ isActive }) =>
                  // The active item gets no background of its own — the sliding pill behind it is
                  // the selected-state affordance, so the usual hover wash is suppressed too.
                  `btn-ghost relative z-10 ${
                    isActive
                      ? 'text-accent hover:bg-transparent hover:text-accent dark:text-accent-light dark:hover:bg-transparent dark:hover:text-accent-light'
                      : ''
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main key={pathname} className="mx-auto max-w-[1800px] px-8 py-10">
        {children}
      </main>
    </div>
  )
}
