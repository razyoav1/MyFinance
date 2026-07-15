import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isConfigured, checkAccess, ensureCustomer, listConnections } from '../_lib/saltedge'

/**
 * GET /api/sync/connections   (header: x-sync-token)
 * Lists the bank connections already established, so the frontend can offer
 * "Sync now" per connection after the user returns from the Connect widget.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!isConfigured()) return res.status(503).json({ error: 'Bank sync is not configured yet. See docs/BANK_SYNC_SETUP.md.' })
  if (!checkAccess(req.headers['x-sync-token'] as string | undefined)) return res.status(401).json({ error: 'Bad sync token' })

  try {
    const customerId = await ensureCustomer()
    res.status(200).json({ connections: await listConnections(customerId) })
  } catch (e) {
    res.status(502).json({ error: (e as Error).message })
  }
}
