import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: '대시보드', end: true },
  { to: '/monthly', label: '월간 상세', end: false },
  { to: '/entries', label: '거래 관리', end: false },
  { to: '/analytics', label: '분석', end: false },
  { to: '/import', label: '불러오기', end: false },
]

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-[1800px] items-center gap-6 px-8 py-4">
          <span className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-800 dark:text-slate-50">
            <svg viewBox="0 0 64 64" className="h-6 w-6" aria-hidden="true">
              <rect width="64" height="64" rx="16" fill="#0f172a" />
              <circle cx="30" cy="30" r="18" fill="#0ea5e9" />
              <circle cx="38" cy="24" r="14" fill="#0f172a" />
            </svg>
            가계부
          </span>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-accent'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && <span className="absolute inset-x-3 -bottom-[17px] h-0.5 rounded-full bg-accent" />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1800px] px-8 py-8">{children}</main>
    </div>
  )
}
