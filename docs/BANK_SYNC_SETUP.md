# Automatic Bank Sync ("Option 2") — Status & Setup

*Research and groundwork done 2026-07-15. Everything here is prepared but **inactive** until you pick a route and do the user-only steps.*

## The research verdict (July 2026)

| Route | Works for Israeli banks? | Verdict |
|---|---|---|
| **Salt Edge** (aggregator) | ❌ No — their live coverage page lists 45 countries, Israel absent; no Hapoalim/Leumi/Discount/Mizrahi/Isracard/Max/Cal. (The "Bank Leumi" they list is the UK subsidiary.) Their free personal tier also ended Oct 2025. | Not viable today |
| **Official Israeli open banking** (Bank of Israel Directive 368) | ❌ Individuals can't get access — API access requires an Israel Securities Authority license, granted only to companies. | Not possible for a personal app |
| **Israeli aggregators** (Finanda, Feezback, Open-Finance.ai) | Cover Israeli banks, but **B2B only** — contact-sales contracts, no self-serve developer signup. | Not viable for personal use |
| **`israeli-bank-scrapers`** (open source) | ✅ Yes — actively maintained (v6.8.0, July 2026), covers Hapoalim, Leumi, Discount, Mizrahi, Isracard, Max, Visa Cal + ~10 more. Logs into the bank's own website with your credentials, locally on your machine. | **The practical route** ✅ |

**Bottom line:** the "clean" aggregator version of Option 2 doesn't exist for Israel right now.
The realistic automatic sync is **Route A** below. The aggregator scaffold (Route B) is kept in
the codebase in case coverage appears later.

---

## Route A (recommended): local sync runner — `scripts/bank-sync/`

A small Node script that runs **on your own computer**, logs into your bank/credit-card sites
with credentials that never leave your machine, and writes one clean CSV per account.
You then click **Import** in the app — the importer recognizes the files automatically and
skips nothing-new rows.

### One-time setup (you, ~10 minutes)
```bash
cd scripts/bank-sync
npm install                              # downloads the scraper library + a headless Chromium
copy config.example.json config.json     # then edit config.json with your credentials
```
- `config.json` is **git-ignored** — it stays on this PC only. Fill in your own credentials;
  never share them or commit them.
- Supported `companyId` values and the exact credential fields per bank:
  https://github.com/eshaham/israeli-bank-scrapers#specific-definitions-per-scraper
- Requires Node.js ≥ 22.12 (`node -v` to check).
- Security tip (from the Caspion project): ask your bank for **read-only** ("צפייה בלבד")
  credentials if available, so the stored login can't move money.

### Every sync (~1 minute)
```bash
cd scripts/bank-sync
npm run sync        # writes out/<bank>-<date>.csv per account
```
Then in the app: **Transactions → Import** → pick the file(s) from `scripts/bank-sync/out/`.

### Want fully hands-off instead?
Mature tools built on the same library, if you'd rather not maintain our own runner:
- **Caspion** (github.com/brafdlog/caspion) — desktop app, one-click sync, exports CSV/Google Sheets.
- **Moneyman** (github.com/daniel-hauser/moneyman) — runs on a schedule (GitHub Actions/Docker); note it stores credentials in cloud secrets, which its own README flags as a trust trade-off.

### Possible next steps for us (when you're ready)
1. Wire the runner's output straight into the app (JSON with stable transaction ids → full
   dedupe via `externalId`, no manual file-picking).
2. Auto-categorization rules (e.g., "רמי לוי" → Food & Dining) applied on every import.
3. A scheduled task on this PC that runs the sync nightly.

---

## Route B (dormant): aggregator backend — `api/sync/*`

A complete stateless Vercel-serverless scaffold for a Salt Edge-style aggregator:

- `GET  /api/sync/status` — is the backend deployed & configured?
- `POST /api/sync/connect` — starts the bank-consent widget flow
- `GET  /api/sync/connections` — lists connected banks
- `GET  /api/sync/transactions` — pulls normalized transactions (the browser stores them; the server keeps nothing)

All endpoints return **503 until** these env vars are set in Vercel:
`SALTEDGE_APP_ID`, `SALTEDGE_SECRET`, `SYNC_ACCESS_TOKEN` (a random string you invent — the
Settings → Bank Sync panel sends it so only you can use your API), `APP_URL`.

This becomes relevant only if Salt Edge adds Israeli coverage, or an Israeli aggregator opens
self-serve access (the helper in `api/_lib/saltedge.ts` is small and easy to adapt).
Frontend pieces are already live: `src/lib/bankSync.ts` + the **Bank Sync** panel in Settings.

---

## Data-model groundwork (already active)

- Transactions now carry optional `externalId` + `source` (`manual` / `csv` / `sync`) — DB v6.
- All bulk imports flow through `importTransactions()` (`src/lib/importTransactions.ts`),
  which skips rows whose `externalId` was already imported — re-syncing an overlapping date
  range can never create duplicates.
