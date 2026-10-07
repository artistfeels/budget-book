// Three growing coin piles on cream, the tallest with a face. Drawn from primitives rather than
// an image so it stays crisp at every size.
// Shared by the nav bar, the login screen, and (as a static copy) public/favicon.svg.

// Each coin is a dark rim ellipse plus a side band; only the top coin shows its lit face,
// because every other coin's top is covered by the rim of the coin above it.
function CoinStack({ cx, rx, ry, count, h }: { cx: number; rx: number; ry: number; count: number; h: number }) {
  const bottom = 49
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const top = bottom - (i + 1) * h
        return (
          <g key={i}>
            <ellipse cx={cx} cy={top + h} rx={rx} ry={ry} fill="#d49a00" />
            <rect x={cx - rx} y={top} width={rx * 2} height={h} fill={i % 2 ? '#e0a800' : '#eaae00'} />
          </g>
        )
      })}
      <ellipse cx={cx} cy={bottom - count * h} rx={rx} ry={ry} fill="#ffd95a" />
    </>
  )
}

export default function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#ffe9a8" />
      <CoinStack cx={17.5} rx={5.5} ry={2.2} count={2} h={6} />
      <CoinStack cx={30} rx={5.5} ry={2.2} count={3} h={6.4} />
      <CoinStack cx={45} rx={8} ry={3} count={5} h={6.4} />
      <g fill="#5a3d00">
        <circle cx="41.8" cy="33.5" r="1.4" />
        <circle cx="48.2" cy="33.5" r="1.4" />
      </g>
      <path d="M43 36.5 Q45 38.3 47 36.5" stroke="#5a3d00" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <g fill="#ff9a8a" opacity=".75">
        <circle cx="39" cy="36.1" r="1.5" />
        <circle cx="51" cy="36.1" r="1.5" />
      </g>
    </svg>
  )
}
