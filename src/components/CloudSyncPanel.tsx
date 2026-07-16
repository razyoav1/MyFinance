import { useEffect, useState } from 'react'
import { Cloud, RefreshCw, LogOut, Upload, Download } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { toast } from '@/store/useToastStore'
import { cloudConfigured, supabase } from '@/lib/supabase'
import {
  signUp, signIn, signOut, currentUsername,
  assessSync, autoSync, pushSnapshot, pullSnapshot, getLastSync,
  type SyncState,
} from '@/lib/cloudSync'

const STATE_LABEL: Record<SyncState, { text: string; cls: string }> = {
  'in-sync':      { text: 'In sync',                        cls: 'text-emerald-500' },
  'no-remote':    { text: 'No cloud backup yet',            cls: 'text-amber-500' },
  'local-newer':  { text: 'This device has newer data',     cls: 'text-amber-500' },
  'remote-newer': { text: 'Cloud has newer data',           cls: 'text-amber-500' },
  'diverged':     { text: 'Conflict — both sides changed',  cls: 'text-red-500' },
}

export function CloudSyncPanel() {
  const [user, setUser] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<SyncState | null>(null)
  const [confirmPull, setConfirmPull] = useState(false)

  const refreshState = () => {
    assessSync().then(setState).catch(() => setState(null))
  }

  useEffect(() => {
    if (!cloudConfigured) return
    currentUsername().then(u => { setUser(u); if (u) refreshState() })
    const { data: sub } = supabase!.auth.onAuthStateChange(() => {
      currentUsername().then(u => { setUser(u); if (u) refreshState(); else setState(null) })
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const run = async (fn: () => Promise<unknown>, okMsg?: string) => {
    setBusy(true)
    try {
      await fn()
      if (okMsg) toast.success(okMsg)
      refreshState()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleSignIn = () => run(async () => {
    await signIn(username, password)
    setPassword('')
    const result = await autoSync()
    if (result === 'remote-newer') toast.success('Signed in — cloud data downloaded to this device')
  }, undefined)

  const handleSignUp = () => {
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    run(async () => {
      await signUp(username, password)
      setPassword('')
      await autoSync()
    }, 'Account created — this device\'s data is now backed up')
  }

  const lastSync = getLastSync()

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-2"><Cloud size={16} /> Cloud Sync</span>
        </CardTitle>
      </CardHeader>

      {!cloudConfigured && (
        <p className="text-sm text-[var(--color-text-muted)]">
          Sync your data across devices with a username + password. The backend isn't configured
          yet — follow <code className="text-[var(--color-text)]">docs/CLOUD_SYNC_SETUP.md</code> in
          the repository (~5 minutes, free tier).
        </p>
      )}

      {cloudConfigured && !user && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-muted)]">
            Sign in and your data follows you to every device. No email needed.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className="w-36" autoComplete="username" />
            <Input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-36" autoComplete="current-password" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSignIn} disabled={busy || !username || !password}>Sign In</Button>
            <Button size="sm" variant="outline" onClick={handleSignUp} disabled={busy || !username || !password}>Create Account</Button>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            Use a strong password you don't use elsewhere — it protects all your financial data.
          </p>
        </div>
      )}

      {cloudConfigured && user && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">Signed in as <strong>{user}</strong></p>
              <p className={`text-xs ${state ? STATE_LABEL[state].cls : 'text-[var(--color-text-muted)]'}`}>
                {state ? STATE_LABEL[state].text : 'Checking…'}
                {lastSync && <span className="text-[var(--color-text-muted)]"> · last synced {new Date(lastSync.at).toLocaleString()}</span>}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => run(() => signOut())} disabled={busy}>
              <LogOut size={13} /> Sign out
            </Button>
          </div>

          {state !== 'diverged' ? (
            <Button size="sm" variant="outline" onClick={() => run(() => autoSync(), 'Synced')} disabled={busy}>
              <RefreshCw size={13} /> Sync now
            </Button>
          ) : (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2">
              <p className="text-xs text-[var(--color-text)]">
                Data changed on this device <em>and</em> in the cloud since the last sync. Pick which
                version to keep — the other is overwritten.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => run(() => pushSnapshot(), 'Cloud updated with this device\'s data')} disabled={busy}>
                  <Upload size={13} /> Keep this device's data
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmPull(true)} disabled={busy}>
                  <Download size={13} /> Use cloud data
                </Button>
              </div>
            </div>
          )}

          <p className="text-xs text-[var(--color-text-muted)]">
            Auto-sync runs every minute while signed in. Data stays on this device too — the cloud is
            a synced copy, and the app keeps working offline.
          </p>
        </div>
      )}

      <ConfirmModal
        open={confirmPull}
        onClose={() => setConfirmPull(false)}
        onConfirm={() => run(() => pullSnapshot(), 'Cloud data downloaded to this device')}
        title="Replace this device's data?"
        message="Everything on this device will be replaced with the cloud version. This cannot be undone."
      />
    </Card>
  )
}
