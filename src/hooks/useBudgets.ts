import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { convertCurrency } from '@/lib/currency'
import { tierOf, TIERS, tierMeta, type ExpenseTier, type TierMeta } from '@/lib/tiers'
import type { Category } from '@/types'

const pad = (n: number) => String(n).padStart(2, '0')
const monthRange = (y: number, m: number) => [`${y}-${pad(m)}-01`, `${y}-${pad(m)}-31`] as const

export interface BudgetRow {
  categoryId: number
  name: string
  icon: string
  color: string
  tier: ExpenseTier
  budget: number      // base currency, 0 when unset
  spent: number       // base currency
  remaining: number   // budget - spent
  pct: number         // spent / budget * 100 (0 when no budget)
  hasBudget: boolean
}

export interface TierGroup {
  key: ExpenseTier
  meta: TierMeta
  rows: BudgetRow[]
  budget: number
  spent: number
}

export interface BudgetPlan {
  rows: BudgetRow[]
  byTier: TierGroup[]
  totalBudget: number
  totalSpent: number
  income: number
}

/** Set (or clear, when amount <= 0) a category's monthly budget. */
export async function setBudget(categoryId: number, amount: number) {
  const existing = await db.budgets.where('categoryId').equals(categoryId).first()
  const now = new Date().toISOString()
  if (amount > 0) {
    if (existing) await db.budgets.update(existing.id!, { amount, updatedAt: now })
    else await db.budgets.add({ categoryId, amount, updatedAt: now })
  } else if (existing) {
    await db.budgets.delete(existing.id!)
  }
}

export function useBudgetPlan(
  year: number,
  month: number,
  baseCurrency: string,
  rates: Record<string, number>,
): BudgetPlan | null {
  return useLiveQuery(async () => {
    const [categories, budgets] = await Promise.all([db.categories.toArray(), db.budgets.toArray()])
    const budgetByCat: Record<number, number> = {}
    for (const b of budgets) budgetByCat[b.categoryId] = b.amount

    const toBase = (amount: number, currency: string) => convertCurrency(amount, currency, baseCurrency, rates)
    const [start, end] = monthRange(year, month)
    const txns = await db.transactions.where('date').between(start, end, true, true).toArray()

    const spentByCat: Record<number, number> = {}
    let income = 0
    for (const t of txns) {
      if (t.type === 'expense') spentByCat[t.categoryId ?? 0] = (spentByCat[t.categoryId ?? 0] ?? 0) + toBase(t.amount, t.currency)
      else if (t.type === 'income') income += toBase(t.amount, t.currency)
    }

    const rows: BudgetRow[] = (categories as Category[])
      .filter(c => c.type !== 'income')
      .map(c => {
        const budget = budgetByCat[c.id!] ?? 0
        const spent = spentByCat[c.id!] ?? 0
        return {
          categoryId: c.id!,
          name: c.name, icon: c.icon, color: c.color, tier: tierOf(c),
          budget, spent, remaining: budget - spent,
          pct: budget > 0 ? (spent / budget) * 100 : 0,
          hasBudget: budget > 0,
        }
      })
      .sort((a, b) => b.spent - a.spent || b.budget - a.budget || a.name.localeCompare(b.name))

    const byTier: TierGroup[] = TIERS.map(m => {
      const tierRows = rows.filter(r => r.tier === m.key)
      return {
        key: m.key, meta: tierMeta(m.key), rows: tierRows,
        budget: tierRows.reduce((s, r) => s + r.budget, 0),
        spent: tierRows.reduce((s, r) => s + r.spent, 0),
      }
    }).filter(g => g.rows.length > 0)

    const totalBudget = budgets.reduce((s, b) => s + b.amount, 0)
    const totalSpent = Object.values(spentByCat).reduce((s, v) => s + v, 0)

    return { rows, byTier, totalBudget, totalSpent, income }
  }, [year, month, baseCurrency, JSON.stringify(rates)]) ?? null
}
