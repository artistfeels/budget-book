import { useThemeStore } from '../store/useThemeStore'

export interface ChartTheme {
  grid: string
  axisTick: string
  cursorFill: string
  ink: string
  tooltipContentStyle: React.CSSProperties
  series: { blue: string; orange: string; aqua: string }
}

const LIGHT: ChartTheme = {
  grid: '#e1e0d9',
  axisTick: '#52514e',
  cursorFill: '#f1f5f9',
  ink: '#0b0b0b',
  tooltipContentStyle: { background: '#fcfcfb', border: '1px solid #e1e0d9', borderRadius: 8, fontSize: 12, color: '#0b0b0b' },
  series: { blue: '#2a78d6', orange: '#eb6834', aqua: '#1baf7a' },
}

const DARK: ChartTheme = {
  grid: '#2c2c2a',
  axisTick: '#c3c2b7',
  cursorFill: 'rgba(255,255,255,0.06)',
  ink: '#ffffff',
  tooltipContentStyle: { background: '#1a1a19', border: '1px solid #2c2c2a', borderRadius: 8, fontSize: 12, color: '#ffffff' },
  series: { blue: '#3987e5', orange: '#d95926', aqua: '#199e70' },
}

// Recharts (and any other inline-styled, non-Tailwind color) needs an explicit JS-side dark-mode
// switch rather than a `dark:` variant. Reads from the same resolved flag the user's light/dark/
// system selection (useThemeStore) drives, so chart colors always agree with the Tailwind classes.
export function useIsDark(): boolean {
  return useThemeStore((s) => s.isDark)
}

export function useChartTheme(): ChartTheme {
  return useIsDark() ? DARK : LIGHT
}
