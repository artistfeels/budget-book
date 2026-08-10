import { useThemeStore, type ThemeMode } from '../store/useThemeStore'

const OPTIONS: { mode: ThemeMode; label: string; icon: JSX.Element }[] = [
  {
    mode: 'light',
    label: '라이트',
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </>
    ),
  },
  {
    mode: 'dark',
    label: '다크',
    icon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  },
  {
    mode: 'system',
    label: '시스템',
    icon: (
      <>
        <rect x="2" y="4" width="20" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </>
    ),
  },
]

export default function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)

  return (
    <div className="segmented">
      {OPTIONS.map((opt) => (
        <button
          key={opt.mode}
          type="button"
          title={opt.label}
          aria-label={opt.label}
          aria-pressed={mode === opt.mode}
          onClick={() => setMode(opt.mode)}
          className={`btn-ghost px-2.5 py-1.5 ${mode === opt.mode ? 'btn-ghost-active' : ''}`}
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
            {opt.icon}
          </svg>
        </button>
      ))}
    </div>
  )
}
