import { useEffect, useState } from 'react'
import { Landmark, RefreshCw, Plus, ExternalLink } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/store/useToastStore'
import {
  getSyncStatus, getSyncToken, setSyncToken, getLastSync,
  startBankConnection, listBankConnections, syncConnection,
  type SyncStatus, type BankConnection,
} from '@/lib/bankSync'

/**
 * Settings panel for automatic bank sync (Option 2 groundwork).
 * Renders one of three states:
 *  - unavailable:   no backend (plain local dev) - explains what this will be
 *  - unconfigured:  backend deployed but aggregator keys not set - shows setup pointer
 *  - ready:         connect banks + sync now
 */
export function BankSyncPanel() {
  const [status, setStatus] = useState<SyncStatus | 'loading'>('loading')
  const [token, setToken] = useState(getSyncToken())
  const [connections, setConnections] = useState<BankConnection[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getSyncStatus().then(setStatus)
  }, [])

  useEffect(() => {
    if (status === 'ready' && getSyncToken()) {
      listBankConnections().then(setConnections).catch(() => setConnections([]))
    }
  }, [status])

  const saveToken = () => {
    setSyncToken(token)
    toast.success('Sync token saved')
    listBankConnections().then(setConnections).catch(e => toast.error((e as Error).message))
  }

  const handleConnect = async () => {
    setBusy(true)
    try {
      const url = await startBankConnection()
      window.open(url, '_blank')
      toast.success('Bank connect page opened in a new tab')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleSync = async (c: BankConnection) => {
    setBusy(true)
    try {
      const { added, duplicates } = await syncConnection(c.id)
      toast.success(`${c.provider_name}: ${added} new transaction${added !== 1 ? 's' : ''}${duplicates > 0 ? ` (${duplicates} already imported)` : ''}`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const lastSync = getLastSync()

  return (
    <Card>
      <CardHeader>
        <CardTitle><span className="flex items-center gap-2"><Landmark size={16} /> Bank Sync <span className="text-[10px] font-bold uppercase tracking-wide bg-[var(--color-accent)]/15 text-[var(--color-accent)] rounded px-1.5 py-0.5">Beta</span></span></CardTitle>
      </CardHeader>

      {status === 'loading' && (
        <p className="text-sm text-[var(--color-text-muted)]">Checking sync backend…</p>
      )}

      {status === 'unavailable' && (
        <div className="text-sm text-[var(--color-text-muted)] space-y-2">
          <p>
            Pull transactions from your Israeli bank &amp; credit cards without manual exports. The
            practical route today is the <strong className="text-[var(--color-text)]">local sync runner</strong>:
            a small script on your PC fetches the transactions and produces files the Import button
            recognizes — your bank credentials never leave your computer.
          </p>
          <p className="text-xs">
            Setup walkthrough: <code className="text-[var(--color-text)]">docs/BANK_SYNC_SETUP.md</code> in the
            repository (Route A). A cloud-aggregator backend is also scaffolded for the future (Route B).
          </p>
        </div>
      )}

      {status === 'unconfigured' && (
        <div className="text-sm text-[var(--color-text-muted)] space-y-2">
          <p>
            The sync backend is deployed but no aggregator keys are set. Note: as of July 2026 no
            aggregator covers Israeli banks for personal use — see{' '}
            <code className="text-[var(--color-text)]">docs/BANK_SYNC_SETUP.md</code> for the local
            sync runner (Route A) instead.
          </p>
        </div>
      )}

      {status === 'ready' && (
        <div className="space-y-4">
          {/* Access token */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text)] mb-1">
              Sync access token
              <span className="ml-1 text-[var(--color-text-muted)] font-normal">— the SYNC_ACCESS_TOKEN you set in Vercel</span>
            </label>
            <div className="flex gap-2">
              <Input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="paste token" className="max-w-xs" />
              <Button size="sm" variant="outline" onClick={saveToken}>Save</Button>
            </div>
          </div>

          {/* Connections */}
          {connections.length > 0 ? (
            <div className="space-y-2">
              {connections.map(c => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">{c.provider_name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {c.status}{c.last_success_at ? ` · last fetched ${c.last_success_at.slice(0, 10)}` : ''}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleSync(c)} disabled={busy}>
                    <RefreshCw size={13} /> Sync now
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No banks connected yet.</p>
          )}

          <Button size="sm" onClick={handleConnect} disabled={busy || !getSyncToken()}>
            <Plus size={14} /> Connect a bank <ExternalLink size={12} />
          </Button>

          {lastSync && (
            <p className="text-xs text-[var(--color-text-muted)]">Last sync: {new Date(lastSync).toLocaleString()}</p>
          )}
        </div>
      )}
    </Card>
  )
}
