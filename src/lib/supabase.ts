/// <reference types="vite/client" />
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Optional cloud-sync backend. The app is local-first and fully functional
 * without it; when these env vars are absent the Cloud Sync panel simply
 * shows setup instructions. Set in Vercel (and .env for local dev):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 * The anon key is a public client key by design — data is protected by
 * per-user row-level security, not by hiding the key.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null

export const cloudConfigured = supabase !== null
