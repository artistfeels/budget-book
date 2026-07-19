import { supabase } from '../lib/supabase'

export default function LoginPage() {
  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <h1 className="mb-6 text-2xl font-bold text-slate-800">가계부</h1>
        <button
          onClick={signInWithGoogle}
          className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
        >
          Google로 로그인
        </button>
      </div>
    </div>
  )
}
