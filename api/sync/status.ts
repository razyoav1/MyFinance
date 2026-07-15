import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isConfigured } from '../_lib/saltedge'

/**
 * GET /api/sync/status
 * Lets the frontend know whether the sync backend exists and is configured.
 * (When the app runs as a plain static site - e.g. `npm run dev` - this
 * endpoint doesn't exist at all and the frontend shows "unavailable".)
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ available: true, configured: isConfigured() })
}
