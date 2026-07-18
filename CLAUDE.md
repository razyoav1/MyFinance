# MyFinance — Claude Project Context

## Project Overview
A personal finance tracking web app built with **React + TypeScript + Vite**. All data is stored **locally in the browser** using IndexedDB (via Dexie). No backend, no server, no authentication.

## Tech Stack
| Layer | Library |
|-------|---------|
| Framework | React 19 + TypeScript |
| Build tool | Vite 6 |
| Routing | react-router-dom v7 |
| Local DB | Dexie v4 (IndexedDB) + dexie-react-hooks |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Icons | lucide-react |
| Global state | Zustand |
| Date utils | date-fns |

## Dev Commands
```bash
npm run dev       # Start dev server (http://localhost:5173)
npm run build     # TypeScript check + Vite production build
npm run preview   # Preview production build locally
```

## Project Structure
```
src/
├── db/
│   └── index.ts          # Dexie DB class + schema versions + seeding
├── types/
│   └── index.ts          # All TypeScript interfaces & types
├── lib/
│   ├── categories.ts     # Default category seed data
│   ├── currency.ts       # Currency formatting helpers
│   ├── cn.ts             # clsx + tailwind-merge utility
│   ├── mortgageCalc.ts   # Amortization schedule calculations
│   └── financeCalc.ts    # General finance calculations
├── hooks/
│   ├── useTransactions.ts   # CRUD + filters + stats hooks
│   ├── useInvestments.ts    # Investment holdings hooks
│   ├── useMortgage.ts       # Mortgage hooks
│   └── useGoals.ts          # Savings goals hooks
├── store/
│   ├── useThemeStore.ts     # Dark/light theme (Zustand + localStorage)
│   └── useCurrencyStore.ts  # Active currency (Zustand + localStorage)
├── components/
│   ├── ui/               # Reusable primitives: Button, Input, Select,
│   │                     #   Card, Badge, Modal, ProgressBar, EmptyState, Textarea
│   └── layout/           # Sidebar, TopBar, MobileNav
├── pages/
│   ├── Dashboard/        # Overview: stats, charts, recent transactions
│   ├── Transactions/     # Transaction list + form (add/edit)
│   ├── Investments/      # Investment holdings tracker
│   ├── Goals/            # Savings goals with progress bars
│   ├── Mortgage/         # Mortgage tracker + amortization table
│   └── Settings/         # Theme, currency, category management
└── App.tsx               # Router setup
```

## Database Schema (Dexie)
The DB is versioned — **always bump the version** when changing the schema or seeding new data.

| Table | Key fields |
|-------|-----------|
| `categories` | `++id, type, name` |
| `transactions` | `++id, date, type, categoryId, currency, externalId` |
| `investmentHoldings` | `++id, symbol, assetType` |
| `investmentPriceHistory` | `++id, holdingId, date` |
| `mortgages` | `++id, isActive` |
| `mortgagePayments` | `++id, mortgageId, paymentDate` |
| `savingsGoals` | `++id, isCompleted` |
| `goalContributions` | `++id, goalId, date` |
| `netWorthSnapshots` | `++id, snapshotDate` |
| `bankAccounts` | `++id, type, currency` |

**Current DB version: 7**
- v1 — initial schema
- v2 — seeded Loan category
- v3 — seeded Rent and Mortgage categories
- v4 — updated Transport icon from 🚗 to 🚌
- v5 — added `bankAccounts` table (Wealth page)
- v6 — indexed `transactions.externalId` for bank-sync dedupe
- v7 — assigned expense-quality `tier` to categories (Analysis page)

## Analysis Page
- `/analysis` (`src/pages/Analysis/index.tsx`) — expense-quality tiers, month-over-month movers, 6-month tier trend, income sources, biggest expenses. Month navigator like the Dashboard.
- Expense categories carry an optional `tier` (`wealth` | `essential` | `lifestyle`); definitions + name-based defaults + `tierOf()` live in `src/lib/tiers.ts`. Editable per-category in Settings.
- All computation is in `src/hooks/useAnalysis.ts` (currency-converted via `convertCurrency`).

## Cloud Sync (cross-device)
- Local-first stays the source of truth; Supabase is an **optional** synced copy. Snapshot-based: one `cloud_snapshots` row per user holds the full backup JSON (schema: `supabase_cloud_sync.sql`, RLS per user).
- Login is username+password via Supabase auth with synthetic emails (`<user>@users.myfinance-app.com`); requires "Confirm email" disabled in Supabase.
- Key files: `src/lib/supabase.ts` (null client when `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` unset), `src/lib/backup.ts` (shared backup format + fingerprint), `src/lib/cloudSync.ts` (auth + push/pull/assess), `src/hooks/useCloudSync.ts` (auto-sync every 60s), `src/components/CloudSyncPanel.tsx` (Settings UI).
- Conflict policy: auto-push/auto-pull only when one side changed; both sides changed → panel makes the user choose. Setup: `docs/CLOUD_SYNC_SETUP.md`.

## Transaction Ingestion & Bank Sync
- All bulk inserts go through `importTransactions()` in `src/lib/importTransactions.ts` — it dedupes on `externalId` (set only by bank sync; CSV rows have none).
- CSV/Excel import: `src/lib/bankImport.ts` auto-detects the header row in Israeli bank exports (they start with intro rows) and Hebrew column names; `src/components/ImportModal.tsx` skips the mapping step when detection succeeds.
- **Option 2 groundwork (not yet active):**
  - `api/sync/*` — Vercel serverless scaffold for the Salt Edge aggregator (env-gated, returns 503 until `SALTEDGE_APP_ID`/`SALTEDGE_SECRET`/`SYNC_ACCESS_TOKEN` are set in Vercel).
  - `src/lib/bankSync.ts` + `src/components/BankSyncPanel.tsx` — frontend client and Settings panel (unavailable/unconfigured/ready states).
  - `scripts/bank-sync/` — standalone local runner using `israeli-bank-scrapers` (own package.json; credentials live in git-ignored `config.json`; outputs CSVs for the import modal).
  - Setup walkthrough and provider decision notes: `docs/BANK_SYNC_SETUP.md`.

## Key Conventions

### Dates
Always stored as `YYYY-MM-DD` strings for easy lexicographic range queries with Dexie's `.between()`.

### Currency
Amounts stored as plain numbers. Currency code stored alongside. Display via `formatCurrency(amount, currency)` from `src/lib/currency.ts`.

### Categories
- System categories (seeded, `isSystem: true`) live in the DB and are migrated via Dexie version upgrades.
- Users can add custom categories in Settings.
- Each category has: `name`, `icon` (emoji), `color` (hex), `type` (`income` | `expense` | `both`).

### Styling
- CSS variables for theming: `--color-bg`, `--color-surface`, `--color-surface2`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`.
- Use `cn()` (from `src/lib/cn.ts`) for conditional class merging.
- Tailwind v4 — no `tailwind.config.js`, configured via CSS `@theme`.

### State Management
- **Server/DB state** — Dexie + `useLiveQuery` hooks (reactive, auto-updates UI on DB change).
- **UI/preference state** — Zustand stores persisted to `localStorage`.

### Adding a New Category via Migration
```ts
// In src/db/index.ts — bump version and add upgrade block:
this.version(N).stores({}).upgrade(async tx => {
  const exists = await tx.table('categories').where('name').equals('CategoryName').count()
  if (exists === 0) {
    await tx.table('categories').add({
      name: 'CategoryName', icon: '🔧', color: '#hexcode', type: 'expense', isSystem: true,
    })
  }
})
```

### Adding a New Page
1. Create `src/pages/MyPage/index.tsx`
2. Add route in `src/App.tsx`
3. Add nav entry in `src/components/layout/Sidebar.tsx` and `src/components/layout/MobileNav.tsx`
