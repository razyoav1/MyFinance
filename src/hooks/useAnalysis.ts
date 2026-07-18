import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { db } from '@/db'
import { convertCurrency } from '@/lib/currency'
import { tierOf, tierMeta, TIERS, type ExpenseTier } from '@/lib/tiers'
import type { Category, Transaction } from '@/types'

const pad = (n: number) => String(n).padStart(2, '0')
const monthRange = (y: number, m: number) =>
  [`${y}-${pad(m)}-01`, `${y}-${pad(m)}-31`] as const

export interface CategoryStat {
  id: number; name: string; icon: string; color: string; value: number; pct: number
}
export interface TierStat {
  key: ExpenseTier; label: string; icon: string; color: string; value: number; pct: number
}
export interface MoverStat {
  id: number; name: string; icon: string; color: string
  current: number; previous: number; delta: number; pct: number | null
}
export interface TopExpense {
  id: number; description: string; icon: string; color: string; date: string; value: number
}
export interface TrendPoint {
  month: string; Wealth: number; Essential: number; Lifestyle: number
}

export interface AnalysisData {
  income: number
  expenses: number
  net: number
  savingsRate: number
  wealthAmount: number      // wealth-tier spend + leftover savings
  wealthPct: number         // as a share of income
  prevMonthLabel: string
  expenseTiers: TierStat[]
  expenseByCategory: CategoryStat[]
  incomeByCategory: CategoryStat[]
  movers: MoverStat[]
  topExpenses: TopExpense[]
  trend: TrendPoint[]
}

const TIER_ACCUM = (): Record<ExpenseTier, number> => ({ wealth: 0, essential: 0, lifestyle: 0 })

export function useAnalysis(
  year: number,
  month: number,
  baseCurrency: string,
  rates: Record<string, number>,
): AnalysisData | null {
  return useLiveQuery(async () => {
    const categories = await db.categories.toArray()
    const catMap: Record<number, Category> = Object.fromEntries(categories.map(c => [c.id!, c]))
    const toBase = (amount: number, currency: string) => convertCurrency(amount, currency, baseCurrency, rates)

    const [start, end] = monthRange(year, month)
    const txns = await db.transactions.where('date').between(start, end, true, true).toArray()

    // Previous month (for movers)
    const prevD = new Date(year, month - 2, 1)
    const [pStart, pEnd] = monthRange(prevD.getFullYear(), prevD.getMonth() + 1)
    const prevTxns = await db.transactions.where('date').between(pStart, pEnd, true, true).toArray()
    const prevMonthLabel = format(prevD, 'MMM')

    const expenseTxns = txns.filter(t => t.type === 'expense')
    const incomeTxns = txns.filter(t => t.type === 'income')

    const income = incomeTxns.reduce((s, t) => s + toBase(t.amount, t.currency), 0)
    const expenses = expenseTxns.reduce((s, t) => s + toBase(t.amount, t.currency), 0)
    const net = income - expenses
    const savingsRate = income > 0 ? (net / income) * 100 : 0

    // ── Expense tiers ──────────────────────────────────────────────────────────
    const tierAcc = TIER_ACCUM()
    for (const t of expenseTxns) tierAcc[tierOf(catMap[t.categoryId ?? -1])] += toBase(t.amount, t.currency)
    const expenseTiers: TierStat[] = TIERS.map(m => ({
      key: m.key, label: m.label, icon: m.icon, color: m.color,
      value: tierAcc[m.key],
      pct: expenses > 0 ? (tierAcc[m.key] / expenses) * 100 : 0,
    }))

    const wealthAmount = tierAcc.wealth + Math.max(0, net)
    const wealthPct = income > 0 ? (wealthAmount / income) * 100 : 0

    // ── By-category groupings ───────────────────────────────────────────────────
    const groupByCategory = (list: Transaction[], total: number): CategoryStat[] => {
      const acc: Record<number, CategoryStat> = {}
      for (const t of list) {
        const id = t.categoryId ?? 0
        if (!acc[id]) {
          const c = catMap[id]
          acc[id] = { id, name: c?.name ?? 'Uncategorized', icon: c?.icon ?? '📦', color: c?.color ?? '#94a3b8', value: 0, pct: 0 }
        }
        acc[id].value += toBase(t.amount, t.currency)
      }
      const rows = Object.values(acc)
      for (const r of rows) r.pct = total > 0 ? (r.value / total) * 100 : 0
      return rows.sort((a, b) => b.value - a.value)
    }
    const expenseByCategory = groupByCategory(expenseTxns, expenses)
    const incomeByCategory = groupByCategory(incomeTxns, income)

    // ── Month-over-month movers (expenses only) ─────────────────────────────────
    const prevByCat: Record<number, number> = {}
    for (const t of prevTxns) if (t.type === 'expense') {
      const id = t.categoryId ?? 0
      prevByCat[id] = (prevByCat[id] ?? 0) + toBase(t.amount, t.currency)
    }
    const curByCat: Record<number, number> = {}
    for (const r of expenseByCategory) curByCat[r.id] = r.value

    const moverIds = new Set([...Object.keys(curByCat), ...Object.keys(prevByCat)].map(Number))
    const movers: MoverStat[] = [...moverIds].map(id => {
      const c = catMap[id]
      const current = curByCat[id] ?? 0
      const previous = prevByCat[id] ?? 0
      const delta = current - previous
      return {
        id, name: c?.name ?? 'Uncategorized', icon: c?.icon ?? '📦', color: c?.color ?? '#94a3b8',
        current, previous, delta,
        pct: previous > 0 ? (delta / previous) * 100 : null,
      }
    }).filter(m => Math.abs(m.delta) > 0.5)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

    // ── Biggest single expenses ─────────────────────────────────────────────────
    const topExpenses: TopExpense[] = expenseTxns
      .map(t => {
        const c = t.categoryId ? catMap[t.categoryId] : undefined
        return { id: t.id!, description: t.description, icon: c?.icon ?? '💳', color: c?.color ?? '#94a3b8', date: t.date, value: toBase(t.amount, t.currency) }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)

    // ── 6-month tier trend (ending at selected month) ───────────────────────────
    const trend: TrendPoint[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1)
      const [s, e] = monthRange(d.getFullYear(), d.getMonth() + 1)
      const mTxns = await db.transactions.where('date').between(s, e, true, true).toArray()
      const acc = TIER_ACCUM()
      for (const t of mTxns) if (t.type === 'expense') acc[tierOf(catMap[t.categoryId ?? -1])] += toBase(t.amount, t.currency)
      trend.push({
        month: format(d, 'MMM'),
        Wealth: Math.round(acc.wealth),
        Essential: Math.round(acc.essential),
        Lifestyle: Math.round(acc.lifestyle),
      })
    }

    return {
      income, expenses, net, savingsRate, wealthAmount, wealthPct, prevMonthLabel,
      expenseTiers, expenseByCategory, incomeByCategory, movers, topExpenses, trend,
    }
  }, [year, month, baseCurrency, JSON.stringify(rates)]) ?? null
}

export { tierMeta }
