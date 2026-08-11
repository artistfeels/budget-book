import { NavLink } from 'react-router-dom'
import { navItems } from './AppShell'

export default function BottomNav() {
  return (
    <nav
      className="glass fixed inset-x-0 bottom-0 z-20 border-t md:hidden"
      // The inset keeps the tab row above the iOS home indicator instead of underneath it.
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch">
        {navItems.map(({ to, label, end, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2 transition-colors duration-200 ${
                isActive
                  ? 'text-accent dark:text-accent-light'
                  : 'text-slate-500 active:text-slate-800 dark:text-slate-400 dark:active:text-slate-100'
              }`
            }
          >
            <Icon className="h-[22px] w-[22px]" />
            <span className="text-[10px] font-medium leading-none tracking-[-0.01em]">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
