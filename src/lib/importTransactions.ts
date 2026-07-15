import { db } from '@/db'
import type { Transaction, TransactionSource } from '@/types'

export interface IncomingTransaction {
  date: string        // YYYY-MM-DD
  description: string
  amount: number
  type: 'income' | 'expense'
  currency: string
  notes?: string
  categoryId?: number
  /** Stable provider id (bank sync). Rows whose externalId already exists are skipped. */
  externalId?: string
}

export interface ImportResult {
  added: number
  duplicates: number
}

/**
 * Shared ingestion path for every bulk source (CSV/Excel import, bank sync).
 * Dedupes on externalId so re-syncing an overlapping date range is safe.
 */
export async function importTransactions(
  items: IncomingTransaction[],
  source: TransactionSource,
): Promise<ImportResult> {
  const externalIds = items.map(i => i.externalId).filter((x): x is string => !!x)
  const existing = externalIds.length > 0
    ? new Set(
        (await db.transactions.where('externalId').anyOf(externalIds).toArray())
          .map(t => t.externalId),
      )
    : new Set<string>()

  const fresh = items.filter(i => !i.externalId || !existing.has(i.externalId))

  if (fresh.length > 0) {
    const now = new Date().toISOString()
    await db.transactions.bulkAdd(
      fresh.map((i): Omit<Transaction, 'id'> => ({
        type: i.type,
        amount: i.amount,
        currency: i.currency,
        categoryId: i.categoryId,
        date: i.date,
        description: i.description,
        notes: i.notes,
        tags: [],
        isRecurring: false,
        createdAt: now,
        updatedAt: now,
        externalId: i.externalId,
        source,
      })),
    )
  }

  return { added: fresh.length, duplicates: items.length - fresh.length }
}
