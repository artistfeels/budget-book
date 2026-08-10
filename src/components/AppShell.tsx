import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'

const navItems = [
  { to: '/', label: '대시보드', end: true },
  { to: '/monthly', label: '월간 상세', end: false },
  { to: '/entries', label: '거래 관리', end: false },
  { to: '/analytics', label: '분석', end: false },
  { to: '/import', label: '불러오기', end: false },
]

export default function AppShell({ children }: { children: ReactNode }) {
  // Keying <main> on the pathname remounts it per route, which re-runs the children's entrance
  // animations — so navigating feels like the new page assembles rather than snapping in.
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-canvas-light dark:bg-canvas-dark">
      <header className="glass sticky top-0 z-10 border-b">
        <div className="mx-auto flex max-w-[1800px] items-center gap-6 px-8 py-3.5">
          <span className="flex select-none items-center gap-2.5 text-[17px] font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">
            <svg viewBox="0 0 64 64" className="h-7 w-7" aria-hidden="true">
              <defs>
                <linearGradient id="nav-mark" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#0a84ff" />
                  <stop offset="100%" stopColor="#0071e3" />
                </linearGradient>
              </defs>
              <rect width="64" height="64" rx="16" fill="#0f172a" />
              <circle cx="30" cy="30" r="18" fill="url(#nav-mark)" />
              <circle cx="38" cy="24" r="14" fill="#0f172a" />
            </svg>
            가계부
          </span>

          <nav className="segmented">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `btn-ghost ${isActive ? 'btn-ghost-active' : ''}`}
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
