import { useEffect } from 'react'
import AuthGuard from './auth/AuthGuard'
import ImportPage from './pages/ImportPage'
import { useTransactionStore } from './store/useTransactionStore'

export default function App() {
  const fetchAll = useTransactionStore((s) => s.fetchAll)

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return (
    <AuthGuard>
      <ImportPage />
    </AuthGuard>
  )
}
