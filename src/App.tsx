import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import AuthGuard from './auth/AuthGuard'
import AppShell from './components/AppShell'
import DashboardPage from './pages/DashboardPage'
import ImportPage from './pages/ImportPage'
import { useTransactionStore } from './store/useTransactionStore'

function MonthDetailPlaceholder() {
  return <div className="rounded-xl bg-white p-6 shadow-sm">월별 상세 (다음 태스크에서 구현)</div>
}

export default function App() {
  const fetchAll = useTransactionStore((s) => s.fetchAll)

  useEffect(() => {
    fetchAll().catch((error) => {
      console.error('Failed to fetch transactions:', error)
    })
  }, [fetchAll])

  return (
    <AuthGuard>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/month/:yyyyMm" element={<MonthDetailPlaceholder />} />
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </AppShell>
    </AuthGuard>
  )
}
