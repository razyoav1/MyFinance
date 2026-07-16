# Cloud Sync — Setup (one time, ~5 minutes, free)

Cloud Sync keeps your data identical on every device: sign in with a username +
password in **Settings → Cloud Sync**, and the app backs up automatically and
pulls the latest data wherever you sign in. The app stays local-first — it
works offline and never *requires* login; the cloud is a synced copy.

## Your steps (only you can do these — they need your accounts)

### 1. Supabase project (the free database)
1. Go to https://supabase.com and sign in (you already have an account from the
   April version — same one is fine, or make a new project).
2. Open your project → **SQL Editor** → paste the contents of
   [`supabase_cloud_sync.sql`](../supabase_cloud_sync.sql) → **Run**.
3. **Authentication → Sign In / Up → Email** — turn **OFF** "Confirm email".
   (Logins here are username-based; the app uses invisible synthetic addresses,
   so confirmation emails would never arrive.)
4. **Project Settings → API** — copy two values:
   - Project URL (like `https://abcdefgh.supabase.co`)
   - `anon` `public` key (long string starting `eyJ…`)

### 2. Tell the app about it
- **Deployed app:** Vercel dashboard → your `my-finance` project → Settings →
  Environment Variables → add both, then redeploy:
  - `VITE_SUPABASE_URL` = the Project URL
  - `VITE_SUPABASE_ANON_KEY` = the anon key
- **Local dev (optional):** create a `.env` file in the repo root with the same
  two lines (`VITE_SUPABASE_URL=...`), it's git-ignored.

### 3. Create your account — in the app, not in chat
Open the app → Settings → **Cloud Sync** → type a username and a **strong,
new password** → **Create Account**. Type the password only into that form.
Never share a password with anyone — including an AI assistant.

## How syncing behaves
- While signed in, the app syncs automatically every minute and at startup:
  local-only changes upload; cloud-only changes download.
- If BOTH sides changed since the last sync (edited on two devices while
  offline), nothing is overwritten automatically — the panel shows a conflict
  and you pick which version wins.
- Signing in on a fresh device downloads everything automatically.

## Security notes
- The `anon` key is a public client key by design; your data is protected by
  row-level security — each account can only ever read/write its own row.
- Your password is checked by Supabase Auth; the app (and its code on GitHub)
  never stores it.
- The password protects ALL your financial data — use a long, unique one, not
  a date of birth.
