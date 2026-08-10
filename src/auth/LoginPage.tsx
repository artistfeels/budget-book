import { supabase } from '../lib/supabase'

export default function LoginPage() {
  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <h1 className="mb-6 text-2xl font-bold text-slate-800 dark:text-slate-50">가계부</h1>
        <button
          onClick={signInWithGoogle}
          className="rounded-lg bg-accent px-6 py-3 font-medium text-white hover:bg-accent-dark"
        >
          Google로 로그인
        </button>
      </div>
    </div>
  )
}
