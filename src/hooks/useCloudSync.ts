import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { autoSync } from '@/lib/cloudSync'

/**
 * App-wide automatic cloud sync: while signed in, runs one safe sync step on
 * startup and then every 60 seconds (push local-only changes, pull cloud-only
 * changes, never overwrites on conflict — the Settings panel handles that).
 */
export function useCloudAutoSync() {
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    const tick = () => autoSync().catch(err => {
      if (!cancelled) console.warn('[cloud-sync]', (err as Error).message)
    })
    tick()
    const interval = setInterval(tick, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [signedIn])
}
