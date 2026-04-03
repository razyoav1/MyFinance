import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Transaction, TransactionWithCategory, Category } from '@/types'
import { useRefresh } from '@/contexts/RefreshContext'
import { format } from 'date-fns'

export interface TransactionFilters {
  month: number
  year: number
  type?: 'income' | 'expense' | 'all'
  categoryId?: number
  search?: string
}

function mapTransaction(row: Record<string, any>): Transaction {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    currency: row.currency,
    categoryId: row.category_id ?? undefined,
    date: row.date,
    description: row.description ?? '',
    notes: row.notes ?? undefined,
    tags: row.tags ?? [],
    isRecurring: row.is_recurring ?? false,
    recurringInterval: row.recurring_interval ?? undefined,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

function mapCategory(row: Record<string, any>): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    type: row.type,
    isSystem: row.is_system ?? false,
  }
}

function transactionToDb(data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>, userId: string, now: string) {
  return {
    user_id: userId,
    type: data.type,
    amount: data.amount,
    currency: data.currency,
    category_id: data.categoryId ?? null,
    date: data.date,
    description: data.description,
    notes: data.notes ?? null,
    tags: data.tags,
    is_recurring: data.isRecurring,
    recurring_interval: data.recurringInterval ?? null,
    created_at: now,
    updated_at: now,
  }
}

function getUserId(): Promise<string | null> {
  return supabase.auth.getSession().then(({ data: { session } }) => session?.user?.id ?? null)
}

export function useTransactions(filters: TransactionFilters): TransactionWithCategory[] {
  const [data, setData] = useState<TransactionWithCategory[]>([])
  const { refreshKey } = useRefresh()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!userId) return

    const startDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
    const endDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-31`

    const fetchData = async () => {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })

      const { data: rows } = await query

      if (!rows) { setData([]); return }

      let results = rows.map(mapTransaction)

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

      const { data: catRows } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)

      const catMap: Record<number, Category> = {}
      for (const c of (catRows ?? [])) {
        catMap[c.id] = mapCategory(c)
      }

      setData(results.map(t => ({ ...t, category: t.categoryId ? catMap[t.categoryId] : undefined })))
    }

    fetchData()
  }, [userId, filters.month, filters.year, filters.type, filters.categoryId, filters.search, refreshKey])

  return data
}

export function useAllTransactions(): TransactionWithCategory[] {
  const [data, setData] = useState<TransactionWithCategory[]>([])
  const { refreshKey } = useRefresh()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!userId) return
    const fetchData = async () => {
      const { data: rows } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })

      if (!rows) { setData([]); return }

      const { data: catRows } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)

      const catMap: Record<number, Category> = {}
      for (const c of (catRows ?? [])) {
        catMap[c.id] = mapCategory(c)
      }

      setData(rows.map(row => {
        const t = mapTransaction(row)
        return { ...t, category: t.categoryId ? catMap[t.categoryId] : undefined }
      }))
    }
    fetchData()
  }, [userId, refreshKey])

  return data
}

export async function addTransaction(data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) {
  const userId = await getUserId()
  if (!userId) throw new Error('Not authenticated')
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('transactions')
    .insert(transactionToDb(data, userId, now))
  if (error) throw error
}

export async function updateTransaction(id: number, data: Partial<Transaction>) {
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  if (data.type !== undefined) updateData.type = data.type
  if (data.amount !== undefined) updateData.amount = data.amount
  if (data.currency !== undefined) updateData.currency = data.currency
  if (data.categoryId !== undefined) updateData.category_id = data.categoryId
  if (data.date !== undefined) updateData.date = data.date
  if (data.description !== undefined) updateData.description = data.description
  if (data.notes !== undefined) updateData.notes = data.notes
  if (data.tags !== undefined) updateData.tags = data.tags
  if (data.isRecurring !== undefined) updateData.is_recurring = data.isRecurring
  if (data.recurringInterval !== undefined) updateData.recurring_interval = data.recurringInterval

  const { error } = await supabase.from('transactions').update(updateData).eq('id', id)
  if (error) throw error
}

export async function deleteTransaction(id: number) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

export function useMonthlyStats(year: number, month: number) {
  const [data, setData] = useState({ income: 0, expenses: 0, net: 0 })
  const { refreshKey } = useRefresh()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!userId) return
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`

    const fetchData = async () => {
      const { data: rows } = await supabase
        .from('transactions')
        .select('type, amount')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)

      if (!rows) return
      const income = rows.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const expenses = rows.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      setData({ income, expenses, net: income - expenses })
    }
    fetchData()
  }, [userId, year, month, refreshKey])

  return data
}

export function useSpendingByCategory(year: number, month: number) {
  const [data, setData] = useState<{ name: string; value: number; color: string; icon: string }[]>([])
  const { refreshKey } = useRefresh()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!userId) return
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`

    const fetchData = async () => {
      const { data: rows } = await supabase
        .from('transactions')
        .select('amount, category_id')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .gte('date', startDate)
        .lte('date', endDate)

      if (!rows) { setData([]); return }

      const { data: catRows } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)

      const catMap: Record<number, Category> = {}
      for (const c of (catRows ?? [])) {
        catMap[c.id] = mapCategory(c)
      }

      const grouped: Record<number, { name: string; value: number; color: string; icon: string }> = {}
      for (const t of rows) {
        const catId = t.category_id ?? 0
        if (!grouped[catId]) {
          const cat = catMap[catId]
          grouped[catId] = {
            name: cat?.name ?? 'Uncategorized',
            value: 0,
            color: cat?.color ?? '#94a3b8',
            icon: cat?.icon ?? '📦',
          }
        }
        grouped[catId].value += Number(t.amount)
      }

      setData(Object.values(grouped).sort((a, b) => b.value - a.value))
    }
    fetchData()
  }, [userId, year, month, refreshKey])

  return data
}

export function useMonthlyTrend(monthsBack = 6) {
  const [data, setData] = useState<{ month: string; income: number; expenses: number }[]>([])
  const { refreshKey } = useRefresh()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!userId) return

    const fetchData = async () => {
      const results = []
      const now = new Date()
      for (let i = monthsBack - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const year = d.getFullYear()
        const month = d.getMonth() + 1
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const endDate = `${year}-${String(month).padStart(2, '0')}-31`

        const { data: rows } = await supabase
          .from('transactions')
          .select('type, amount')
          .eq('user_id', userId)
          .gte('date', startDate)
          .lte('date', endDate)

        const income = (rows ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
        const expenses = (rows ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
        results.push({ month: format(d, 'MMM'), income, expenses })
      }
      setData(results)
    }
    fetchData()
  }, [userId, monthsBack, refreshKey])

  return data
}
