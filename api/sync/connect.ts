import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isConfigured, checkAccess, ensureCustomer, createConnectSession } from '../_lib/saltedge'

/**
 * POST /api/sync/connect   (header: x-sync-token)
 * Creates a Salt Edge Connect session and returns { connect_url }.
 * The user opens connect_url and logs in to their bank on Salt Edge's page -
 * bank credentials never pass through this server.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!isConfigured()) return res.status(503).json({ error: 'Bank sync is not configured yet. See docs/BANK_SYNC_SETUP.md.' })
  if (!checkAccess(req.headers['x-sync-token'] as string | undefined)) return res.status(401).json({ error: 'Bad sync token' })

  try {
    const customerId = await ensureCustomer()
    const connectUrl = await createConnectSession(customerId)
    res.status(200).json({ connect_url: connectUrl })
  } catch (e) {
    res.status(502).json({ error: (e as Error).message })
  }
}
