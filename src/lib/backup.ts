import { db } from '@/db'
import type {
  Category, Transaction, InvestmentHolding, InvestmentPriceHistory,
  Mortgage, MortgagePayment, SavingsGoal, GoalContribution, NetWorthSnapshot, BankAccount,
} from '@/types'

/**
 * One backup format used everywhere: the Settings "Export Data (JSON)" file,
 * the Import/Restore button, and Cloud Sync snapshots.
 * Key names predate some tables (e.g. `investments`) — kept for backward
 * compatibility with old backup files.
 */
export interface BackupData {
  categories?: Category[]
  transactions?: Transaction[]
  investments?: InvestmentHolding[]
  investmentPriceHistory?: InvestmentPriceHistory[]
  mortgages?: Mortgage[]
  mortgagePayments?: MortgagePayment[]
  goals?: SavingsGoal[]
  goalContributions?: GoalContribution[]
  netWorthSnapshots?: NetWorthSnapshot[]
  bankAccounts?: BankAccount[]
}

const ALL_TABLES = [
  db.categories, db.transactions, db.investmentHoldings, db.investmentPriceHistory,
  db.mortgages, db.mortgagePayments, db.savingsGoals, db.goalContributions,
  db.netWorthSnapshots, db.bankAccounts,
]

export async function buildBackup(): Promise<BackupData> {
  return {
    categories: await db.categories.toArray(),
    transactions: await db.transactions.toArray(),
    investments: await db.investmentHoldings.toArray(),
    investmentPriceHistory: await db.investmentPriceHistory.toArray(),
    mortgages: await db.mortgages.toArray(),
    mortgagePayments: await db.mortgagePayments.toArray(),
    goals: await db.savingsGoals.toArray(),
    goalContributions: await db.goalContributions.toArray(),
    netWorthSnapshots: await db.netWorthSnapshots.toArray(),
    bankAccounts: await db.bankAccounts.toArray(),
  }
}

/** Merge a backup into the current data (used by file Import/Restore). */
export async function mergeBackup(data: BackupData): Promise<void> {
  await db.transaction('rw', ALL_TABLES, async () => {
    if (data.categories) await db.categories.bulkPut(data.categories)
    if (data.transactions) await db.transactions.bulkPut(data.transactions)
    if (data.investments) await db.investmentHoldings.bulkPut(data.investments)
    if (data.investmentPriceHistory) await db.investmentPriceHistory.bulkPut(data.investmentPriceHistory)
    if (data.mortgages) await db.mortgages.bulkPut(data.mortgages)
    if (data.mortgagePayments) await db.mortgagePayments.bulkPut(data.mortgagePayments)
    if (data.goals) await db.savingsGoals.bulkPut(data.goals)
    if (data.goalContributions) await db.goalContributions.bulkPut(data.goalContributions)
    if (data.netWorthSnapshots) await db.netWorthSnapshots.bulkPut(data.netWorthSnapshots)
    if (data.bankAccounts) await db.bankAccounts.bulkPut(data.bankAccounts)
  })
}

/** Replace ALL local data with the backup (used by Cloud Sync pulls). */
export async function replaceWithBackup(data: BackupData): Promise<void> {
  await db.transaction('rw', ALL_TABLES, async () => {
    for (const table of ALL_TABLES) await table.clear()
    await mergeBackup(data)
  })
}

/**
 * Cheap change fingerprint: per-table row count + newest updatedAt/date.
 * Used by Cloud Sync to detect "did anything change locally since last sync"
 * without serializing the whole database.
 */
export async function dataFingerprint(): Promise<string> {
  const parts: string[] = []
  for (const table of ALL_TABLES) {
    const rows = await table.toArray()
    let newest = ''
    for (const r of rows as { updatedAt?: string; date?: string }[]) {
      const stamp = r.updatedAt ?? r.date ?? ''
      if (stamp > newest) newest = stamp
    }
    parts.push(`${table.name}:${rows.length}:${newest}`)
  }
  return parts.join('|')
}
