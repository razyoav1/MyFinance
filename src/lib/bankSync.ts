import { importTransactions, type ImportResult } from './importTransactions'

/**
 * Frontend client for the bank-sync backend (/api/sync/*, Vercel functions).
 * The backend is a thin stateless proxy to the aggregator: transactions land
 * in the browser database like everything else - the local-first model is
 * unchanged. See docs/BANK_SYNC_SETUP.md.
 */

export type SyncStatus = 'unavailable' | 'unconfigured' | 'ready'

export interface BankConnection {
  id: string
  provider_name: string
  status: string
  last_success_at: string | null
}

const TOKEN_KEY = 'myfinance-sync-token'
const LAST_SYNC_KEY = 'myfinance-sync-last'

export const getSyncToken = () => localStorage.getItem(TOKEN_KEY) ?? ''
export const setSyncToken = (t: string) => localStorage.setItem(TOKEN_KEY, t.trim())
export const getLastSync = () => localStorage.getItem(LAST_SYNC_KEY)

function authHeaders(): Record<string, string> {
  return { 'x-sync-token': getSyncToken() }
}

/** Probe the backend. 'unavailable' = no /api at all (e.g. local dev server). */
export async function getSyncStatus(): Promise<SyncStatus> {
  try {
    const res = await fetch('/api/sync/status')
    if (!res.ok) return 'unavailable'
    const json = await res.json()
    if (json?.available !== true) return 'unavailable'
    return json.configured ? 'ready' : 'unconfigured'
  } catch {
    return 'unavailable'
  }
}

/** Start the bank-connect flow; returns the Salt Edge widget URL to open. */
export async function startBankConnection(): Promise<string> {
  const res = await fetch('/api/sync/connect', { method: 'POST', headers: authHeaders() })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error ?? `Connect failed (${res.status})`)
  return json.connect_url
}

export async function listBankConnections(): Promise<BankConnection[]> {
  const res = await fetch('/api/sync/connections', { headers: authHeaders() })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error ?? `Listing connections failed (${res.status})`)
  return json.connections ?? []
}

/**
 * Pull transactions for one connection into the local database.
 * Dedupes on externalId, so overlapping date ranges are safe to re-sync.
 */
export async function syncConnection(connectionId: string, fromDate?: string): Promise<ImportResult> {
  const params = new URLSearchParams({ connection_id: connectionId })
  if (fromDate) params.set('from_date', fromDate)
  const res = await fetch(`/api/sync/transactions?${params}`, { headers: authHeaders() })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error ?? `Sync failed (${res.status})`)

  const rows = (json.transactions ?? []) as {
    externalId: string; date: string; description: string; amount: number; currency: string; notes?: string
  }[]

  const result = await importTransactions(
    rows.map(r => ({
      date: r.date,
      description: r.description,
      amount: Math.abs(r.amount),
      type: r.amount >= 0 ? 'income' as const : 'expense' as const,
      currency: r.currency,
      notes: r.notes,
      externalId: r.externalId,
    })),
    'sync',
  )
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
  return result
}
