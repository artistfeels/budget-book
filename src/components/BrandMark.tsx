import { useId } from 'react'

// The won mark, drawn as strokes rather than a text glyph — a <text> element in an SVG favicon
// renders inconsistently across browsers and depends on a font being available at paint time.
// Shared by the nav bar, the login screen, and (as a static copy) public/favicon.svg.
export default function BrandMark({ className }: { className?: string }) {
  // Two BrandMarks on one page would otherwise declare the same gradient id, and the second
  // definition would win for both.
  const gradientId = useId()

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0a84ff" />
          <stop offset="100%" stopColor="#0071e3" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${gradientId})`} />
      <g stroke="#fff" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M15 19 L23 43 L32 26 L41 43 L49 19" strokeWidth="5" />
        <path d="M12 31 H52" strokeWidth="4.5" />
        <path d="M12 38.5 H52" strokeWidth="4.5" />
      </g>
    </svg>
  )
}
