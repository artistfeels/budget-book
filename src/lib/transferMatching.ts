export interface TransferCandidate {
  id: string
  amount: number
  paymentMethod: string
  dateTimeMinutes: number
}

export interface TransferMatchResult {
  pairs: Array<{ a: string; b: string }>
  unmatchedIds: string[]
}

export function dateTimeToMinutes(date: string, time: string): number {
  return Date.parse(`${date}T${time}.000Z`) / 60000
}

export function matchTransferPairs(candidates: TransferCandidate[]): TransferMatchResult {
  const used = new Set<string>()
  const pairs: Array<{ a: string; b: string }> = []

  for (const a of candidates) {
    if (used.has(a.id)) continue

    let best: TransferCandidate | null = null
    let bestDiff = Infinity

    for (const b of candidates) {
      if (a.id === b.id || used.has(b.id)) continue
      if (b.amount !== -a.amount) continue
      if (b.paymentMethod === a.paymentMethod) continue
      const diff = Math.abs(a.dateTimeMinutes - b.dateTimeMinutes)
      if (diff > 3) continue
      if (diff < bestDiff) {
        bestDiff = diff
        best = b
      }
    }

    if (best) {
      used.add(a.id)
      used.add(best.id)
      pairs.push({ a: a.id, b: best.id })
    }
  }

  const unmatchedIds = candidates.filter((c) => !used.has(c.id)).map((c) => c.id)
  return { pairs, unmatchedIds }
}
