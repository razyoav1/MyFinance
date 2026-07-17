import { parse, format, addWeeks, addMonths, addYears } from 'date-fns'
import { db } from '@/db'
import type { Transaction } from '@/types'

/**
 * Recurring-transaction engine. The ↻ flag alone doesn't create anything —
 * this runs at app startup and materializes every due occurrence:
 *
 * - Recurring transactions are grouped into a series by type + category +
 *   description; the LATEST entry of each series is the template.
 * - While the next occurrence date (latest date + interval) is today or in
 *   the past, a real transaction is created for it. Future dates are never
 *   created ahead of time.
 * - Naturally idempotent: once the latest occurrence is current, the next
 *   date is in the future and reruns do nothing.
 *
 * Note: monthly dates on the 29th-31st clamp to shorter months (Jan 31 →
 * Feb 28) and keep the clamped day afterwards - fine for typical bills.
 */

const DATE_FMT = 'yyyy-MM-dd'

function nextDate(dateStr: string, interval: NonNullable<Transaction['recurringInterval']>): string {
  const d = parse(dateStr, DATE_FMT, new Date())
  switch (interval) {
    case 'weekly':   return format(addWeeks(d, 1), DATE_FMT)
    case 'biweekly': return format(addWeeks(d, 2), DATE_FMT)
    case 'monthly':  return format(addMonths(d, 1), DATE_FMT)
    case 'yearly':   return format(addYears(d, 1), DATE_FMT)
  }
}

const seriesKey = (t: Transaction) =>
  `${t.type}|${t.categoryId ?? 0}|${t.description.trim().toLowerCase()}`

let ranThisLoad = false

/** Create all due occurrences of recurring transactions. Returns how many were added. */
export async function processRecurringTransactions(): Promise<number> {
  // Guard against double-mounted startup effects (React StrictMode) and
  // run everything in one rw transaction so concurrent runs serialize -
  // a second run sees the first run's inserts and generates nothing.
  if (ranThisLoad) return 0
  ranThisLoad = true
  return db.transaction('rw', db.transactions, generateDueOccurrences)
}

async function generateDueOccurrences(): Promise<number> {
  const recurring = await db.transactions.filter(t => t.isRecurring === true).toArray()
  if (recurring.length === 0) return 0

  // Latest entry per series is the template the next occurrence copies from
  const latestPerSeries = new Map<string, Transaction>()
  for (const t of recurring) {
    const key = seriesKey(t)
    const cur = latestPerSeries.get(key)
    if (!cur || t.date > cur.date) latestPerSeries.set(key, t)
  }

  const today = format(new Date(), DATE_FMT)
  const now = new Date().toISOString()
  const toAdd: Omit<Transaction, 'id'>[] = []

  for (const template of latestPerSeries.values()) {
    const interval = template.recurringInterval ?? 'monthly'
    let last = template.date
    let guard = 0
    for (let due = nextDate(last, interval); due <= today && guard < 36; due = nextDate(last, interval), guard++) {
      toAdd.push({
        type: template.type,
        amount: template.amount,
        currency: template.currency,
        categoryId: template.categoryId,
        date: due,
        description: template.description,
        notes: template.notes,
        tags: [],
        isRecurring: true,
        recurringInterval: interval,
        createdAt: now,
        updatedAt: now,
        source: 'recurring',
      })
      last = due
    }
  }

  if (toAdd.length > 0) await db.transactions.bulkAdd(toAdd as Transaction[])
  return toAdd.length
}
