import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import AuthGuard from './auth/AuthGuard'
import AppShell from './components/AppShell'
import { useTransactionStore } from './store/useTransactionStore'

// Route-level code splitting: the Excel parser (xlsx) and the chart-heavy pages only download when
// their screen is opened, instead of every visit paying for all of them up front.
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const MonthDetailPage = lazy(() => import('./pages/MonthDetailPage'))
const EntriesPage = lazy(() => import('./pages/EntriesPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const ImportPage = lazy(() => import('./pages/ImportPage'))

function StatusMessage({ children }: { children: ReactNode }) {
  return <div className="card animate-fade-up p-4 text-slate-500 md:p-6 dark:text-slate-400">{children}</div>
}

// Lives inside AuthGuard so the first fetch runs with a signed-in session, and keeps pages from
// rendering their "no data yet" empty state while data is still loading or after a failed load.
function DataGate({ children }: { children: ReactNode }) {
  const fetchAll = useTransactionStore((s) => s.fetchAll)
  const loading = useTransactionStore((s) => s.loading)
  const loadError = useTransactionStore((s) => s.loadError)
  const hasData = useTransactionStore((s) => s.transactions.length > 0)

  useEffect(() => {
    fetchAll().catch((error) => console.error('Failed to fetch transactions:', error))
  }, [fetchAll])

  if (loadError && !hasData) {
    return (
      <StatusMessage>
        <p className="mb-3 text-rose-600 dark:text-rose-400">데이터를 불러오지 못했습니다: {loadError}</p>
        <button onClick={() => fetchAll().catch(() => {})} className="btn-primary">
          다시 시도
        </button>
      </StatusMessage>
    )
  }
  if (loading && !hasData) return <StatusMessage>불러오는 중…</StatusMessage>
  return <>{children}</>
}

export default function App() {
  return (
    <AuthGuard>
      <AppShell>
        <DataGate>
          <Suspense fallback={<StatusMessage>불러오는 중…</StatusMessage>}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/monthly" element={<MonthDetailPage />} />
              <Route path="/monthly/:yyyyMm" element={<MonthDetailPage />} />
              <Route path="/entries" element={<EntriesPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/import" element={<ImportPage />} />
            </Routes>
          </Suspense>
        </DataGate>
      </AppShell>
    </AuthGuard>
  )
}
