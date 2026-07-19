import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import AuthGuard from './auth/AuthGuard'
import AppShell from './components/AppShell'
import DashboardPage from './pages/DashboardPage'
import ImportPage from './pages/ImportPage'
import MonthDetailPage from './pages/MonthDetailPage'
import { useTransactionStore } from './store/useTransactionStore'

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
          <Route path="/month/:yyyyMm" element={<MonthDetailPage />} />
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </AppShell>
    </AuthGuard>
  )
}
