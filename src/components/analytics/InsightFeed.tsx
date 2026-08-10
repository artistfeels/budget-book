import type { Insight } from '../../lib/analyticsAggregations'

interface InsightFeedProps {
  insights: Insight[]
}

export default function InsightFeed({ insights }: InsightFeedProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <p className="mb-4 font-medium text-slate-700 dark:text-slate-200">인사이트</p>
      {insights.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">아직 표시할 인사이트가 없어요.</p>
      ) : (
        <ul className="space-y-2">
          {insights.map((insight, i) => (
            <li
              key={i}
              className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {insight.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
