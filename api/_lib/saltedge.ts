/**
 * Salt Edge Account Information API helper (SCAFFOLD).
 *
 * Salt Edge is the aggregator that connects to Israeli banks. Nothing here
 * runs until these environment variables are set in Vercel:
 *
 *   SALTEDGE_APP_ID      - from your Salt Edge dashboard (Secrets & Keys)
 *   SALTEDGE_SECRET      - from your Salt Edge dashboard (Secrets & Keys)
 *   SYNC_ACCESS_TOKEN    - any long random string you invent; the app sends it
 *                          with every request so strangers can't use your API
 *   APP_URL              - e.g. https://my-finance-weld-two.vercel.app
 *
 * See docs/BANK_SYNC_SETUP.md for the full setup walkthrough.
 *
 * NOTE: endpoints follow Salt Edge API v6. Live (production) apps also require
 * RSA request signing (Signature header) - add it when upgrading from the
 * Pending/Test tier. https://docs.saltedge.com/
 */

const BASE = 'https://www.saltedge.com/api/v6'

/** One fixed customer for this single-user app. */
export const CUSTOMER_IDENTIFIER = 'myfinance-owner'

export function isConfigured(): boolean {
  return !!(process.env.SALTEDGE_APP_ID && process.env.SALTEDGE_SECRET && process.env.SYNC_ACCESS_TOKEN)
}

/** Constant-time-ish check of the shared token sent by the frontend. */
export function checkAccess(reqToken: string | undefined): boolean {
  const expected = process.env.SYNC_ACCESS_TOKEN
  return !!expected && !!reqToken && reqToken === expected
}

async function se(path: string, init: { method?: string; body?: unknown } = {}): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'App-Id': process.env.SALTEDGE_APP_ID!,
      'Secret': process.env.SALTEDGE_SECRET!,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json?.error?.message ?? json?.error_message ?? `Salt Edge ${res.status}`
    throw new Error(msg)
  }
  return json.data ?? json
}

/** Find-or-create the single customer this app uses. Returns the customer id. */
export async function ensureCustomer(): Promise<string> {
  const list = await se('/customers')
  const found = Array.isArray(list) ? list.find((c: any) => c.identifier === CUSTOMER_IDENTIFIER) : undefined
  if (found) return found.id
  const created = await se('/customers', { method: 'POST', body: { data: { identifier: CUSTOMER_IDENTIFIER } } })
  return created.id
}

/**
 * Create a Salt Edge Connect session. The returned connect_url opens Salt
 * Edge's own widget where the OWNER logs in to their bank (their credentials
 * never touch this server).
 */
export async function createConnectSession(customerId: string): Promise<string> {
  const returnTo = `${process.env.APP_URL ?? ''}/#/settings?sync=connected`
  const data = await se('/connections/connect', {
    method: 'POST',
    body: {
      data: {
        customer_id: customerId,
        consent: { scopes: ['accounts', 'transactions'] },
        attempt: { return_to: returnTo, fetch_scopes: ['accounts', 'transactions'] },
      },
    },
  })
  return data.connect_url
}

export interface SeConnection {
  id: string
  provider_name: string
  status: string
  last_success_at: string | null
}

export async function listConnections(customerId: string): Promise<SeConnection[]> {
  const data = await se(`/connections?customer_id=${encodeURIComponent(customerId)}`)
  return (Array.isArray(data) ? data : []).map((c: any) => ({
    id: c.id,
    provider_name: c.provider_name ?? c.provider_code ?? 'Bank',
    status: c.status,
    last_success_at: c.last_success_at ?? null,
  }))
}

export interface SeTransaction {
  externalId: string
  date: string        // YYYY-MM-DD
  description: string
  amount: number      // signed: negative = expense
  currency: string
  notes?: string
}

/** Fetch all transactions for every account of a connection, normalized. */
export async function fetchTransactions(connectionId: string, fromDate?: string): Promise<SeTransaction[]> {
  const accounts = await se(`/accounts?connection_id=${encodeURIComponent(connectionId)}`)
  const out: SeTransaction[] = []
  for (const acc of Array.isArray(accounts) ? accounts : []) {
    let nextId: string | undefined
    do {
      const params = new URLSearchParams({ connection_id: connectionId, account_id: acc.id })
      if (fromDate) params.set('from_date', fromDate)
      if (nextId) params.set('from_id', nextId)
      const page = await se(`/transactions?${params}`)
      const items = Array.isArray(page) ? page : page.transactions ?? []
      for (const t of items) {
        out.push({
          externalId: `se-${t.id}`,
          date: t.made_on,
          description: t.description ?? '',
          amount: Number(t.amount),
          currency: t.currency_code ?? acc.currency_code ?? 'ILS',
          notes: t.extra?.additional ?? undefined,
        })
      }
      nextId = page?.meta?.next_id ?? undefined
    } while (nextId)
  }
  return out
}
