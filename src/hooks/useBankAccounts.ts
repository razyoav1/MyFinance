import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { BankAccount } from '@/types'

export function useBankAccounts() {
  return useLiveQuery(() => db.bankAccounts.orderBy('id').toArray()) ?? []
}

export async function addBankAccount(data: Omit<BankAccount, 'id'>) {
  return db.bankAccounts.add(data)
}

export async function updateBankAccount(id: number, data: Partial<BankAccount>) {
  return db.bankAccounts.update(id, { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteBankAccount(id: number) {
  return db.bankAccounts.delete(id)
}
