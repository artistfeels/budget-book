import BrandMark from '../components/BrandMark'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas-light px-6 dark:bg-canvas-dark">
      {/* Soft accent bloom behind the card — the only decorative element on the screen, and the
          thing that keeps a single centered card from reading as an empty page. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 blur-[120px] dark:bg-accent-light/20"
      />
      <div className="card animate-scale-in relative w-full max-w-sm p-10 text-center">
        <BrandMark className="mx-auto mb-6 h-14 w-14" />
        <h1 className="mb-2 text-2xl font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">가계부</h1>
        <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">돈이 어디로 가는지, 한눈에.</p>
        <button onClick={signInWithGoogle} className="btn-primary w-full py-2.5">
          Google로 로그인
        </button>
      </div>
    </div>
  )
}
