import { useThemeStore } from '../store/useThemeStore'

export interface ChartTheme {
  grid: string
  axisTick: string
  cursorFill: string
  ink: string
  tooltipContentStyle: React.CSSProperties
  series: { blue: string; orange: string; aqua: string }
}

// Tooltips mirror the app's .card treatment (rounded-2xl, hairline border, layered shadow) so a
// hovering tooltip reads as the same material as the panel it floats over.
const TOOLTIP_BASE: React.CSSProperties = {
  borderRadius: 14,
  fontSize: 12,
  padding: '10px 12px',
}

const LIGHT: ChartTheme = {
  grid: 'rgba(0,0,0,0.06)',
  axisTick: '#6e6e73',
  cursorFill: 'rgba(0,0,0,0.035)',
  ink: '#1d1d1f',
  tooltipContentStyle: {
    ...TOOLTIP_BASE,
    background: 'rgba(255,255,255,0.92)',
    border: '1px solid rgba(0,0,0,0.06)',
    boxShadow: '0 8px 32px -8px rgba(0,0,0,0.18)',
    color: '#1d1d1f',
  },
  series: { blue: '#2a78d6', orange: '#eb6834', aqua: '#1baf7a' },
}

const DARK: ChartTheme = {
  grid: 'rgba(255,255,255,0.07)',
  axisTick: '#98989d',
  cursorFill: 'rgba(255,255,255,0.05)',
  ink: '#f5f5f7',
  tooltipContentStyle: {
    ...TOOLTIP_BASE,
    background: 'rgba(28,28,30,0.94)',
    border: '1px solid rgba(255,255,255,0.09)',
    boxShadow: '0 8px 32px -8px rgba(0,0,0,0.7)',
    color: '#f5f5f7',
  },
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
