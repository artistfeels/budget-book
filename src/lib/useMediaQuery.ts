import { useEffect, useState } from 'react'

/**
 * Client-only media query subscription. The initial value is read lazily from matchMedia rather
 * than defaulted to false, so the first paint already matches the real viewport — this app is a
 * Vite SPA with no SSR, so there is no hydration mismatch to worry about.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const list = window.matchMedia(query)
    // Re-read on subscribe: the viewport can change between the lazy initializer and this effect.
    setMatches(list.matches)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}
