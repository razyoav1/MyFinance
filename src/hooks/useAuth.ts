import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { DEFAULT_CATEGORIES } from '@/lib/categories'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  // Check URL hash immediately — before HashRouter clears it
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
    const hash = window.location.hash
    return hash.includes('type=recovery')
  })

  useEffect(() => {
    // Safety timeout — never get stuck loading forever
    const timeout = setTimeout(() => setLoading(false), 5000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout)
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch(() => {
      clearTimeout(timeout)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
        return
      }

      const newUser = session?.user ?? null
      setUser(newUser)

      if (_event === 'SIGNED_IN' && newUser) {
        // Seed default categories if none exist
        const { count } = await supabase
          .from('categories')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', newUser.id)
        if (count === 0) {
          await supabase.from('categories').insert(
            DEFAULT_CATEGORIES.map(c => ({
              name: c.name,
              icon: c.icon,
              color: c.color,
              type: c.type,
              is_system: c.isSystem ?? false,
              user_id: newUser.id,
            }))
          )
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading, isPasswordRecovery, setIsPasswordRecovery }
}
