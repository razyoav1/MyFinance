import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Bank-sync backend (SCAFFOLD) - one self-contained Vercel function serving:
 *
 *   GET  /api/sync/status        -> { available, configured }
 *   POST /api/sync/connect       -> { connect_url }   (opens aggregator's bank-login widget)
 *   GET  /api/sync/connections   -> { connections: [...] }
 *   GET  /api/sync/transactions?connection_id=&from_date= -> { transactions: [...] }
 *
 * Everything except /status requires the x-sync-token header (SYNC_ACCESS_TOKEN).
 * All aggregator calls are inert until these env vars are set in Vercel:
 *   SALTEDGE_APP_ID, SALTEDGE_SECRET, SYNC_ACCESS_TOKEN, APP_URL
 *
 * NOTE (research 2026-07): Salt Edge does not currently cover Israeli banks -
 * this scaffold is kept for when an aggregator with a similar API does. The
 * practical route today is scripts/bank-sync/. See docs/BANK_SYNC_SETUP.md.
 * Endpoints follow Salt Edge API v6; Live tier additionally requires RSA
 * request signing (Signature header) - add it when upgrading past Test.
 */

const BASE = 'https://www.saltedge.com/api/v6'
const CUSTOMER_IDENTIFIER = 'myfinance-owner'

const isConfigured = () =>
  !!(process.env.SALTEDGE_APP_ID && process.env.SALTEDGE_SECRET && process.env.SYNC_ACCESS_TOKEN)

const checkAccess = (reqToken: string | undefined) => {
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
  const json: any = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json?.error?.message ?? json?.error_message ?? `Aggregator error ${res.status}`)
  }
  return json.data ?? json
}

/** Find-or-create the single customer this personal app uses. */
async function ensureCustomer(): Promise<string> {
  const list = await se('/customers')
  const found = Array.isArray(list) ? list.find((c: any) => c.identifier === CUSTOMER_IDENTIFIER) : undefined
  if (found) return found.id
  const created = await se('/customers', { method: 'POST', body: { data: { identifier: CUSTOMER_IDENTIFIER } } })
  return created.id
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action ?? '')

  if (action === 'status') {
    return res.status(200).json({ available: true, configured: isConfigured() })
  }

  if (!isConfigured()) {
    return res.status(503).json({ error: 'Bank sync is not configured yet. See docs/BANK_SYNC_SETUP.md.' })
  }
  if (!checkAccess(req.headers['x-sync-token'] as string | undefined)) {
    return res.status(401).json({ error: 'Bad sync token' })
  }

  try {
    switch (action) {
      case 'connect': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
        const customerId = await ensureCustomer()
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
        return res.status(200).json({ connect_url: data.connect_url })
      }

      case 'connections': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
        const customerId = await ensureCustomer()
        const data = await se(`/connections?customer_id=${encodeURIComponent(customerId)}`)
        const connections = (Array.isArray(data) ? data : []).map((c: any) => ({
          id: c.id,
          provider_name: c.provider_name ?? c.provider_code ?? 'Bank',
          status: c.status,
          last_success_at: c.last_success_at ?? null,
        }))
        return res.status(200).json({ connections })
      }

      case 'transactions': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
        const connectionId = String(req.query.connection_id ?? '')
        if (!connectionId) return res.status(400).json({ error: 'connection_id is required' })
        const fromDate = req.query.from_date ? String(req.query.from_date) : undefined

        const accounts = await se(`/accounts?connection_id=${encodeURIComponent(connectionId)}`)
        const out: any[] = []
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
        return res.status(200).json({ transactions: out })
      }

      default:
        return res.status(404).json({ error: `Unknown action: ${action}` })
    }
  } catch (e) {
    return res.status(502).json({ error: (e as Error).message })
  }
}
