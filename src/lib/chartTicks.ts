// Recharts' auto-generated Y-axis ticks land on whatever the data range implies (e.g. 137, 284,
// 431...), which reads as noise on a currency axis. Snap to the classic 1-2-5-10 "nice number"
// step so ticks land on round values like 100만/200만/300만원 instead.
function niceStep(rawStep: number): number {
  if (rawStep <= 0) return 1
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const residual = rawStep / magnitude
  if (residual > 5) return 10 * magnitude
  if (residual > 2) return 5 * magnitude
  if (residual > 1) return 2 * magnitude
  return magnitude
}

export function niceAxisTicks(maxValue: number, minValue = 0, tickCount = 5): number[] {
  if (maxValue <= minValue) return [minValue]
  const step = niceStep((maxValue - minValue) / tickCount)
  const niceMin = Math.floor(minValue / step) * step
  const niceMax = Math.ceil(maxValue / step) * step
  const ticks: number[] = []
  for (let t = niceMin; t <= niceMax + step / 2; t += step) {
    ticks.push(Math.round(t))
  }
  return ticks
}
