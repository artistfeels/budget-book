export function formatKRW(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  return `${sign}${Math.abs(amount).toLocaleString('ko-KR')}원`
}

export function formatManwon(amount: number): string {
  const manwon = amount / 10000
  return `${manwon.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만원`
}

/** Axis-tick formatter: drops the 원 suffix and collapses 만/억 so labels stay narrow on phones. */
export function formatKRWCompact(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  if (abs >= 100_000_000) return `${sign}${trimUnit(abs / 100_000_000)}억`
  if (abs >= 10_000) return `${sign}${trimUnit(abs / 10_000)}만`
  return `${sign}${abs.toLocaleString('ko-KR')}`
}

// One decimal place, but never a trailing ".0" — "1만" reads better than "1.0만" on an axis.
// Truncated rather than rounded so a tick never reads higher than the value it marks.
function trimUnit(value: number): string {
  return (Math.trunc(value * 10) / 10).toLocaleString('ko-KR', { maximumFractionDigits: 1 })
}
