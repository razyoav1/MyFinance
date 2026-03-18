import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { SavingsGoal, GoalContribution } from '@/types'

export function useGoals() {
  return useLiveQuery(() => db.savingsGoals.orderBy('id').toArray()) ?? []
}

export function useGoalContributions(goalId?: number) {
  return useLiveQuery(async () => {
    if (!goalId) return []
    return db.goalContributions
      .where('goalId').equals(goalId)
      .sortBy('date')
  }, [goalId]) ?? []
}

export async function addGoal(data: Omit<SavingsGoal, 'id'>) {
  return db.savingsGoals.add(data)
}

export async function updateGoal(id: number, data: Partial<SavingsGoal>) {
  return db.savingsGoals.update(id, data)
}

export async function deleteGoal(id: number) {
  await db.goalContributions.where('goalId').equals(id).delete()
  await db.savingsGoals.delete(id)
}

export async function addContribution(goalId: number, amount: number, date: string, notes?: string) {
  await db.goalContributions.add({ goalId, amount, date, notes })
  const goal = await db.savingsGoals.get(goalId)
  if (goal) {
    const newAmount = goal.currentAmount + amount
    await db.savingsGoals.update(goalId, {
      currentAmount: newAmount,
      isCompleted: newAmount >= goal.targetAmount,
    })
  }
}
