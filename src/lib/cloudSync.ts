import { supabase } from './supabase'
import { buildBackup, replaceWithBackup, dataFingerprint, type BackupData } from './backup'

/**
 * Snapshot-based cloud sync: the whole local database is stored as one JSON
 * snapshot per user in the `cloud_snapshots` table (RLS: users see only their
 * own row). Simple, predictable, and reuses the existing backup format.
 *
 * Login is username + password. Supabase auth is email-based under the hood,
 * so usernames map to a synthetic address the user never sees or uses.
 */

const EMAIL_DOMAIN = 'users.myfinance-app.com'
const LAST_SYNC_KEY = 'myfinance-cloud-lastsync'

const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '')}@${EMAIL_DOMAIN}`

export interface LastSync {
  at: string           // ISO timestamp of last successful push/pull
  fingerprint: string  // local data fingerprint right after that sync
}

export const getLastSync = (): LastSync | null => {
  try { return JSON.parse(localStorage.getItem(LAST_SYNC_KEY) ?? 'null') } catch { return null }
}
const setLastSync = async (at: string) =>
  localStorage.setItem(LAST_SYNC_KEY, JSON.stringify({ at, fingerprint: await dataFingerprint() } satisfies LastSync))

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signUp(username: string, password: string) {
  if (!supabase) throw new Error('Cloud sync is not configured')
  const { error } = await supabase.auth.signUp({ email: usernameToEmail(username), password })
  if (error) throw new Error(error.message)
}

export async function signIn(username: string, password: string) {
  if (!supabase) throw new Error('Cloud sync is not configured')
  const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password })
  if (error) throw new Error(error.message.includes('Invalid login credentials') ? 'Wrong username or password' : error.message)
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function currentUsername(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  const email = data.session?.user?.email
  return email ? email.split('@')[0] : null
}

// ─── Snapshots ────────────────────────────────────────────────────────────────

async function requireUserId(): Promise<string> {
  const { data } = await supabase!.auth.getSession()
  const id = data.session?.user?.id
  if (!id) throw new Error('Not signed in')
  return id
}

export async function fetchRemoteMeta(): Promise<{ updatedAt: string } | null> {
  if (!supabase) return null
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('cloud_snapshots').select('updated_at').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? { updatedAt: data.updated_at } : null
}

/** Upload the whole local database as this user's snapshot. */
export async function pushSnapshot(): Promise<void> {
  if (!supabase) throw new Error('Cloud sync is not configured')
  const userId = await requireUserId()
  const now = new Date().toISOString()
  const { error } = await supabase.from('cloud_snapshots').upsert(
    { user_id: userId, data: await buildBackup(), updated_at: now },
    { onConflict: 'user_id' },
  )
  if (error) throw new Error(error.message)
  await setLastSync(now)
}

/** Replace all local data with the cloud snapshot. */
export async function pullSnapshot(): Promise<void> {
  if (!supabase) throw new Error('Cloud sync is not configured')
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('cloud_snapshots').select('data, updated_at').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No cloud backup exists yet')
  await replaceWithBackup(data.data as BackupData)
  await setLastSync(data.updated_at)
}

// ─── Sync decision ────────────────────────────────────────────────────────────

export type SyncState =
  | 'in-sync'        // nothing to do
  | 'local-newer'    // local changed since last sync → push
  | 'remote-newer'   // cloud changed (another device) → pull
  | 'diverged'       // both changed → user must choose
  | 'no-remote'      // signed in but no snapshot yet → push

export async function assessSync(): Promise<SyncState> {
  const remote = await fetchRemoteMeta()
  if (!remote) return 'no-remote'
  const last = getLastSync()
  const localChanged = !last || (await dataFingerprint()) !== last.fingerprint
  const remoteChanged = !last || remote.updatedAt > last.at
  if (localChanged && remoteChanged) return 'diverged'
  if (localChanged) return 'local-newer'
  if (remoteChanged) return 'remote-newer'
  return 'in-sync'
}

/**
 * One safe automatic sync step: push if only local changed, pull if only the
 * cloud changed, do nothing on conflict (the panel surfaces that to the user).
 * Returns the state it found.
 */
export async function autoSync(): Promise<SyncState> {
  const state = await assessSync()
  if (state === 'local-newer' || state === 'no-remote') await pushSnapshot()
  else if (state === 'remote-newer') await pullSnapshot()
  return state
}
