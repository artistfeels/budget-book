import AuthGuard from './auth/AuthGuard'

export default function App() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50 p-8">
        <h1 className="text-2xl font-bold text-slate-800">가계부</h1>
      </div>
    </AuthGuard>
  )
}
