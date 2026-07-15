import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isConfigured, checkAccess, fetchTransactions } from '../_lib/saltedge'

/**
 * GET /api/sync/transactions?connection_id=...&from_date=YYYY-MM-DD
 * (header: x-sync-token)
 * Returns normalized transactions for one bank connection. The frontend
 * stores them in the browser database (the server keeps nothing) and skips
 * rows it has already imported via their externalId.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!isConfigured()) return res.status(503).json({ error: 'Bank sync is not configured yet. See docs/BANK_SYNC_SETUP.md.' })
  if (!checkAccess(req.headers['x-sync-token'] as string | undefined)) return res.status(401).json({ error: 'Bad sync token' })

  const connectionId = String(req.query.connection_id ?? '')
  if (!connectionId) return res.status(400).json({ error: 'connection_id is required' })
  const fromDate = req.query.from_date ? String(req.query.from_date) : undefined

  try {
    res.status(200).json({ transactions: await fetchTransactions(connectionId, fromDate) })
  } catch (e) {
    res.status(502).json({ error: (e as Error).message })
  }
}
