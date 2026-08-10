import { useThemeStore, type ThemeMode } from '../store/useThemeStore'

const OPTIONS: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: 'light', label: '라이트', icon: '☀️' },
  { mode: 'dark', label: '다크', icon: '🌙' },
  { mode: 'system', label: '시스템', icon: '🖥️' },
]

export default function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-900">
      {OPTIONS.map((opt) => (
        <button
          key={opt.mode}
          type="button"
          title={opt.label}
          aria-label={opt.label}
          aria-pressed={mode === opt.mode}
          onClick={() => setMode(opt.mode)}
          className={`rounded-md px-2 py-1 text-sm transition-colors ${
            mode === opt.mode
              ? 'bg-white text-accent shadow-sm dark:bg-slate-700 dark:text-accent-light'
              : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200'
          }`}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  )
}
