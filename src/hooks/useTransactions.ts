import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { Transaction, TransactionWithCategory } from '@/types'
import { format } from 'date-fns'

export interface TransactionFilters {
  month: number
  year: number
  type?: 'income' | 'expense' | 'all'
  categoryId?: number
  search?: string
}

export function useTransactions(filters: TransactionFilters): TransactionWithCategory[] {
  return useLiveQuery(async () => {
    const startDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
    const endDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-31`

    let query = db.transactions.where('date').between(startDate, endDate, true, true)
    let results = await query.toArray()

    if (filters.type && filters.type !== 'all') {
      results = results.filter(t => t.type === filters.type)
    }
    if (filters.categoryId) {
      results = results.filter(t => t.categoryId === filters.categoryId)
    }
    if (filters.search?.trim()) {
      const s = filters.search.toLowerCase()
      results = results.filter(t =>
        t.description.toLowerCase().includes(s) ||
        t.tags.some(tag => tag.toLowerCase().includes(s))
      )
    }

    // Sort by date desc
    results.sort((a, b) => b.date.localeCompare(a.date))

    // Join categories
    const categories = await db.categories.toArray()
    const catMap = Object.fromEntries(categories.map(c => [c.id!, c]))

    return results.map(t => ({ ...t, category: t.categoryId ? catMap[t.categoryId] : undefined }))
  }, [filters.month, filters.year, filters.type, filters.categoryId, filters.search]) ?? []
}

export function useAllTransactions(): TransactionWithCategory[] {
  return useLiveQuery(async () => {
    const all = await db.transactions.orderBy('date').reverse().toArray()
    const categories = await db.categories.toArray()
    const catMap = Object.fromEntries(categories.map(c => [c.id!, c]))
    return all.map(t => ({ ...t, category: t.categoryId ? catMap[t.categoryId] : undefined }))
  }) ?? []
}

export async function addTransaction(data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = new Date().toISOString()
  return db.transactions.add({ ...data, createdAt: now, updatedAt: now })
}

export async function updateTransaction(id: number, data: Partial<Transaction>) {
  return db.transactions.update(id, { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteTransaction(id: number) {
  return db.transactions.delete(id)
}

export function useMonthlyStats(year: number, month: number) {
  return useLiveQuery(async () => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`
    const txns = await db.transactions.where('date').between(startDate, endDate, true, true).toArray()

    const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { income, expenses, net: income - expenses }
  }, [year, month]) ?? { income: 0, expenses: 0, net: 0 }
}

export function useSpendingByCategory(year: number, month: number) {
  return useLiveQuery(async () => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`
    const txns = await db.transactions
      .where('date').between(startDate, endDate, true, true)
      .filter(t => t.type === 'expense')
      .toArray()

    const categories = await db.categories.toArray()
    const catMap = Object.fromEntries(categories.map(c => [c.id!, c]))

    const grouped: Record<number, { name: string; value: number; color: string; icon: string }> = {}
    for (const t of txns) {
      const catId = t.categoryId ?? 0
      if (!grouped[catId]) {
        const cat = catMap[catId]
        grouped[catId] = {
          name: cat?.name ?? 'Uncategorized',
          value: 0,
          color: cat?.color ?? '#94a3b8',
          icon: cat?.icon ?? '📦',
        }
      }
      grouped[catId].value += t.amount
    }

    return Object.values(grouped).sort((a, b) => b.value - a.value)
  }, [year, month]) ?? []
}

export function useMonthlyTrend(monthsBack = 6) {
  return useLiveQuery(async () => {
    const results = []
    const now = new Date()
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = d.getMonth() + 1
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = `${year}-${String(month).padStart(2, '0')}-31`
      const txns = await db.transactions.where('date').between(startDate, endDate, true, true).toArray()
      const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      results.push({
        month: format(d, 'MMM'),
        income,
        expenses,
      })
    }
    return results
  }, [monthsBack]) ?? []
}
