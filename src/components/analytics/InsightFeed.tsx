import type { Insight } from '../../lib/analyticsAggregations'

interface InsightFeedProps {
  insights: Insight[]
}

// Literal class names, not a `stagger-${i}` template — Tailwind scans source text, so an
// interpolated name would be purged from the build.
const STAGGER = ['stagger-1', 'stagger-2', 'stagger-3', 'stagger-4', 'stagger-5', 'stagger-6']

export default function InsightFeed({ insights }: InsightFeedProps) {
  return (
    <div className="card animate-fade-up p-6">
      <p className="card-title mb-5">인사이트</p>
      {insights.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">아직 표시할 인사이트가 없어요.</p>
      ) : (
        <ul className="space-y-2">
          {insights.map((insight, i) => (
            <li
              key={i}
              className={`animate-fade-up rounded-xl bg-black/[0.03] px-4 py-3 text-sm text-slate-700 dark:bg-white/[0.04] dark:text-slate-200 ${
                STAGGER[Math.min(i, STAGGER.length - 1)]
              }`}
            >
              {insight.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
