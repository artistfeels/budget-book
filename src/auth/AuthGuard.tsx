import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import LoginPage from './LoginPage'

export default function AuthGuard({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas-light text-sm text-slate-500 dark:bg-canvas-dark dark:text-slate-400">
        <span className="animate-fade-in">불러오는 중…</span>
      </div>
    )
  }

  if (session === null) {
    return <LoginPage />
  }

  return <>{children}</>
}
