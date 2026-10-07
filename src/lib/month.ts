// `YYYY-MM` month-key helpers shared across pages and aggregations. All math is in local time,
// matching how dates are entered and displayed.

/** `YYYY-MM` key for a Date — the month-key convention used across the app. */
export function currentMonthKey(today: Date): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
}

/** The month `delta` months away from `month` (negative for earlier months). */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  return currentMonthKey(new Date(y, m - 1 + delta, 1))
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/**
 * How many days of `month` have actually happened as of `today`: the whole month for past months,
 * today's date for the current month, and 0 for future months.
 */
export function elapsedDaysInMonth(month: string, today: Date): number {
  const current = currentMonthKey(today)
  if (month < current) return daysInMonth(month)
  if (month > current) return 0
  return today.getDate()
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** `2026-09-15` → `9월 15일 (화)`: how a person reads a date, not how the database stores it. */
export function formatDayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${m}월 ${d}일 (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`
}

/** `2026-09` → `2026년 9월`. */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${y}년 ${m}월`
}
