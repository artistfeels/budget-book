import { useEffect } from 'react'
import AuthGuard from './auth/AuthGuard'
import ImportPage from './pages/ImportPage'
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
      <ImportPage />
    </AuthGuard>
  )
}
