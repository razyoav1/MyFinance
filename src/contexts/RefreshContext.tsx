import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface RefreshContextType {
  refreshKey: number
  refresh: () => void
}

const RefreshContext = createContext<RefreshContextType>({ refreshKey: 0, refresh: () => {} })

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])
  return <RefreshContext.Provider value={{ refreshKey, refresh }}>{children}</RefreshContext.Provider>
}

export const useRefresh = () => useContext(RefreshContext)
