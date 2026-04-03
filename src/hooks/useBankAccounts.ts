import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { BankAccount } from '@/types'
import { useRefresh } from '@/contexts/RefreshContext'

function mapBankAccount(row: Record<string, any>): BankAccount {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    balance: Number(row.balance),
    currency: row.currency ?? 'ILS',
    icon: row.institution ?? '🏦',
    notes: row.notes ?? undefined,
    updatedAt: row.updated_at ?? '',
  }
}

function bankAccountToDb(data: Omit<BankAccount, 'id'>, userId: string) {
  return {
    user_id: userId,
    name: data.name,
    type: data.type,
    balance: data.balance,
    currency: data.currency,
    institution: data.icon ?? null,
    notes: data.notes ?? null,
    created_at: new Date().toISOString(),
    updated_at: data.updatedAt ?? new Date().toISOString(),
  }
}

function getUserId(): Promise<string | null> {
  return supabase.auth.getSession().then(({ data: { session } }) => session?.user?.id ?? null)
}

export function useBankAccounts() {
  const [data, setData] = useState<BankAccount[]>([])
  const { refreshKey } = useRefresh()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!userId) return
    const fetchData = async () => {
      const { data: rows } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', userId)
        .order('id', { ascending: true })

      setData((rows ?? []).map(mapBankAccount))
    }
    fetchData()
  }, [userId, refreshKey])

  return data
}

export async function addBankAccount(data: Omit<BankAccount, 'id'>) {
  const userId = await getUserId()
  if (!userId) throw new Error('Not authenticated')
  const { error } = await supabase.from('bank_accounts').insert(bankAccountToDb(data, userId))
  if (error) throw error
}

export async function updateBankAccount(id: number, data: Partial<BankAccount>) {
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  if (data.name !== undefined) updateData.name = data.name
  if (data.type !== undefined) updateData.type = data.type
  if (data.balance !== undefined) updateData.balance = data.balance
  if (data.currency !== undefined) updateData.currency = data.currency
  if (data.icon !== undefined) updateData.institution = data.icon
  if (data.notes !== undefined) updateData.notes = data.notes

  const { error } = await supabase.from('bank_accounts').update(updateData).eq('id', id)
  if (error) throw error
}

export async function deleteBankAccount(id: number) {
  const { error } = await supabase.from('bank_accounts').delete().eq('id', id)
  if (error) throw error
}
