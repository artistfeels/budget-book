import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme-mode'

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolveIsDark(mode: ThemeMode): boolean {
  return mode === 'system' ? systemPrefersDark() : mode === 'dark'
}

// Tailwind's `dark:` classes key off this class (darkMode: 'class'), so it's the single source
// of truth the whole app (including non-Tailwind consumers like Recharts, via useIsDark) reads from.
function applyDocumentClass(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark)
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = isDark ? '#020617' : '#f8fafc'
}

interface ThemeState {
  mode: ThemeMode
  isDark: boolean
  setMode: (mode: ThemeMode) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: readStoredMode(),
  isDark: resolveIsDark(readStoredMode()),
  setMode: (mode) => {
    window.localStorage.setItem(STORAGE_KEY, mode)
    const isDark = resolveIsDark(mode)
    applyDocumentClass(isDark)
    set({ mode, isDark })
  },
}))

if (typeof window !== 'undefined') {
  // index.html's inline bootstrap script already set the class before first paint (avoiding a
  // flash), but re-apply here too so the store and DOM agree even if that script is ever removed.
  applyDocumentClass(resolveIsDark(readStoredMode()))

  // Only matters while mode is 'system' — a fixed light/dark choice shouldn't react to OS changes.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { mode } = useThemeStore.getState()
    if (mode !== 'system') return
    const isDark = resolveIsDark(mode)
    applyDocumentClass(isDark)
    useThemeStore.setState({ isDark })
  })
}
