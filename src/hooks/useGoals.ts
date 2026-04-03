import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { SavingsGoal, GoalContribution } from '@/types'
import { useRefresh } from '@/contexts/RefreshContext'

function mapGoal(row: Record<string, any>): SavingsGoal {
  return {
    id: row.id,
    name: row.name,
    targetAmount: Number(row.target_amount),
    currentAmount: Number(row.current_amount ?? 0),
    currency: row.currency ?? 'ILS',
    targetDate: row.deadline ?? undefined,
    icon: row.icon ?? '🎯',
    color: row.color ?? '#6366f1',
    isCompleted: row.is_completed ?? false,
  }
}

function mapContribution(row: Record<string, any>): GoalContribution {
  return {
    id: row.id,
    goalId: row.goal_id,
    amount: Number(row.amount),
    date: row.date,
    notes: row.notes ?? undefined,
  }
}

function goalToDb(data: Omit<SavingsGoal, 'id'>, userId: string) {
  return {
    user_id: userId,
    name: data.name,
    target_amount: data.targetAmount,
    current_amount: data.currentAmount,
    currency: data.currency,
    deadline: data.targetDate ?? null,
    icon: data.icon,
    color: data.color,
    is_completed: data.isCompleted,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function getUserId(): Promise<string | null> {
  return supabase.auth.getSession().then(({ data: { session } }) => session?.user?.id ?? null)
}

export function useGoals() {
  const [data, setData] = useState<SavingsGoal[]>([])
  const { refreshKey } = useRefresh()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!userId) return
    const fetchData = async () => {
      const { data: rows } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', userId)
        .order('id', { ascending: true })

      setData((rows ?? []).map(mapGoal))
    }
    fetchData()
  }, [userId, refreshKey])

  return data
}

export function useGoalContributions(goalId?: number) {
  const [data, setData] = useState<GoalContribution[]>([])
  const { refreshKey } = useRefresh()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!userId || !goalId) { setData([]); return }
    const fetchData = async () => {
      const { data: rows } = await supabase
        .from('goal_contributions')
        .select('*')
        .eq('user_id', userId)
        .eq('goal_id', goalId)
        .order('date', { ascending: true })

      setData((rows ?? []).map(mapContribution))
    }
    fetchData()
  }, [userId, goalId, refreshKey])

  return data
}

export async function addGoal(data: Omit<SavingsGoal, 'id'>) {
  const userId = await getUserId()
  if (!userId) throw new Error('Not authenticated')
  const { error } = await supabase.from('savings_goals').insert(goalToDb(data, userId))
  if (error) throw error
}

export async function updateGoal(id: number, data: Partial<SavingsGoal>) {
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  if (data.name !== undefined) updateData.name = data.name
  if (data.targetAmount !== undefined) updateData.target_amount = data.targetAmount
  if (data.currentAmount !== undefined) updateData.current_amount = data.currentAmount
  if (data.currency !== undefined) updateData.currency = data.currency
  if (data.targetDate !== undefined) updateData.deadline = data.targetDate
  if (data.icon !== undefined) updateData.icon = data.icon
  if (data.color !== undefined) updateData.color = data.color
  if (data.isCompleted !== undefined) updateData.is_completed = data.isCompleted

  const { error } = await supabase.from('savings_goals').update(updateData).eq('id', id)
  if (error) throw error
}

export async function deleteGoal(id: number) {
  // First delete all contributions for this goal
  await supabase.from('goal_contributions').delete().eq('goal_id', id)
  const { error } = await supabase.from('savings_goals').delete().eq('id', id)
  if (error) throw error
}

export async function addContribution(goalId: number, amount: number, date: string, notes?: string) {
  const userId = await getUserId()
  if (!userId) throw new Error('Not authenticated')

  const { error } = await supabase.from('goal_contributions').insert({
    user_id: userId,
    goal_id: goalId,
    amount,
    date,
    notes: notes ?? null,
    created_at: new Date().toISOString(),
  })
  if (error) throw error

  // Update goal's current_amount and check is_completed
  const { data: goalRow } = await supabase
    .from('savings_goals')
    .select('current_amount, target_amount')
    .eq('id', goalId)
    .single()

  if (goalRow) {
    const newAmount = Number(goalRow.current_amount) + amount
    await supabase.from('savings_goals').update({
      current_amount: newAmount,
      is_completed: newAmount >= Number(goalRow.target_amount),
      updated_at: new Date().toISOString(),
    }).eq('id', goalId)
  }
}
