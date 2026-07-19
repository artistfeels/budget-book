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

interface CandidatePair {
  a: TransferCandidate
  b: TransferCandidate
  diff: number
}

export function matchTransferPairs(candidates: TransferCandidate[]): TransferMatchResult {
  // Build the full set of valid candidate pairs (opposite sign, different payment
  // method, within 3 minutes), then sort ALL of them by time difference ascending
  // and walk that list greedily, taking a pair only if neither side is already
  // used. This implements "글로벌 최근접 우선" greedy matching per design doc 3.6,
  // rather than picking each candidate's own best partner in input-array order
  // (which can miss the globally closest pair when multiple same-amount
  // transfers compete for the same counterpart).
  const candidatePairs: CandidatePair[] = []
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i]
      const b = candidates[j]
      if (b.amount !== -a.amount) continue
      if (b.paymentMethod === a.paymentMethod) continue
      const diff = Math.abs(a.dateTimeMinutes - b.dateTimeMinutes)
      if (diff > 3) continue
      candidatePairs.push({ a, b, diff })
    }
  }

  candidatePairs.sort((x, y) => x.diff - y.diff)

  const used = new Set<string>()
  const pairs: Array<{ a: string; b: string }> = []

  for (const { a, b } of candidatePairs) {
    if (used.has(a.id) || used.has(b.id)) continue
    used.add(a.id)
    used.add(b.id)
    pairs.push({ a: a.id, b: b.id })
  }

  const unmatchedIds = candidates.filter((c) => !used.has(c.id)).map((c) => c.id)
  return { pairs, unmatchedIds }
}
