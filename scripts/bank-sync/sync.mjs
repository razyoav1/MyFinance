/**
 * MyFinance local bank sync (Option 2b) — SCAFFOLD, runs entirely on YOUR computer.
 *
 * Uses the open-source `israeli-bank-scrapers` library to log in to your
 * Israeli bank / credit-card websites (with credentials you keep in a local
 * config.json that is git-ignored) and writes one clean CSV per account into
 * ./out/. Drag that CSV onto the app's Import button — the importer
 * recognizes the format automatically.
 *
 * Setup (one time):
 *   cd scripts/bank-sync
 *   npm install                        # downloads the scraper + Chromium
 *   copy config.example.json config.json
 *   ...edit config.json with your own credentials (stays on this PC)
 *
 * Run (whenever you want fresh data):
 *   npm run sync
 *
 * Credentials never leave this machine and are never committed to git.
 */
import { createScraper } from 'israeli-bank-scrapers'
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const configPath = join(here, 'config.json')

if (!existsSync(configPath)) {
  console.error('Missing config.json. Copy config.example.json to config.json and fill in your credentials.')
  process.exit(1)
}

const config = JSON.parse(readFileSync(configPath, 'utf-8'))
const outDir = join(here, 'out')
mkdirSync(outDir, { recursive: true })

const startDate = new Date()
startDate.setMonth(startDate.getMonth() - (config.monthsBack ?? 3))

const csvEscape = v => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

let totalRows = 0
for (const account of config.accounts) {
  console.log(`\n▶ ${account.companyId} — scraping…`)
  const scraper = createScraper({
    companyId: account.companyId,          // e.g. 'hapoalim', 'leumi', 'isracard', 'max', 'visaCal'
    startDate,
    combineInstallments: false,
    showBrowser: false,
  })

  const result = await scraper.scrape(account.credentials)
  if (!result.success) {
    console.error(`✗ ${account.companyId}: ${result.errorType ?? ''} ${result.errorMessage ?? ''}`)
    continue
  }

  const rows = [['Date', 'Description', 'Amount', 'Currency', 'Reference']]
  for (const acc of result.accounts ?? []) {
    for (const txn of acc.txns ?? []) {
      rows.push([
        txn.date.slice(0, 10),                       // YYYY-MM-DD
        txn.description ?? '',
        txn.chargedAmount ?? txn.originalAmount,     // negative = expense
        txn.originalCurrency ?? 'ILS',
        txn.identifier ?? '',
      ])
    }
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const file = join(outDir, `${account.companyId}-${stamp}.csv`)
  writeFileSync(file, '﻿' + rows.map(r => r.map(csvEscape).join(',')).join('\n'), 'utf-8')
  console.log(`✓ ${account.companyId}: ${rows.length - 1} transactions → ${file}`)
  totalRows += rows.length - 1
}

console.log(`\nDone. ${totalRows} transactions exported. Import the CSV file(s) from scripts/bank-sync/out/ using the app's Import button.`)
