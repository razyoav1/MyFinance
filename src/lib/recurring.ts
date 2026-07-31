import { parse, format, addWeeks, addMonths, addYears } from 'date-fns'
import { db } from '@/db'
import type { Transaction } from '@/types'

/**
 * Recurring-transaction engine. The ↻ flag alone doesn't create anything —
 * this runs at app startup and materializes every due occurrence:
 *
 * - Recurring transactions are grouped into a series by type + category +
 *   description; the LATEST entry of each series is the template.
 * - Occurrences are created from the template forward through the END OF THE
 *   CURRENT YEAR, so the remaining months already show the recurring items
 *   (rent, salary, subscriptions…) for planning. Past-due gaps are filled too.
 * - Naturally idempotent: once occurrences reach year-end, the next date is
 *   past the horizon and reruns do nothing. In a new year the horizon moves
 *   and the next year's occurrences fill in.
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

  // Project recurring transactions through the end of the current year, so the
  // remaining months already show them (not just up to today).
  const horizon = `${new Date().getFullYear()}-12-31`
  const now = new Date().toISOString()
  const toAdd: Omit<Transaction, 'id'>[] = []

  for (const template of latestPerSeries.values()) {
    const interval = template.recurringInterval ?? 'monthly'
    let last = template.date
    let guard = 0
    for (let due = nextDate(last, interval); due <= horizon && guard < 500; due = nextDate(last, interval), guard++) {
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
        tier: template.tier,
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
