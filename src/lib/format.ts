export function formatKRW(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  return `${sign}${Math.abs(amount).toLocaleString('ko-KR')}원`
}

export function formatManwon(amount: number): string {
  const manwon = amount / 10000
  return `${manwon.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만원`
}
