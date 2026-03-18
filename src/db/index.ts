import Dexie, { type EntityTable } from 'dexie'
import type {
  Category, Transaction, InvestmentHolding, InvestmentPriceHistory,
  Mortgage, MortgagePayment, SavingsGoal, GoalContribution, NetWorthSnapshot
} from '@/types'
import { DEFAULT_CATEGORIES } from '@/lib/categories'

class MyFinanceDB extends Dexie {
  categories!: EntityTable<Category, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  investmentHoldings!: EntityTable<InvestmentHolding, 'id'>
  investmentPriceHistory!: EntityTable<InvestmentPriceHistory, 'id'>
  mortgages!: EntityTable<Mortgage, 'id'>
  mortgagePayments!: EntityTable<MortgagePayment, 'id'>
  savingsGoals!: EntityTable<SavingsGoal, 'id'>
  goalContributions!: EntityTable<GoalContribution, 'id'>
  netWorthSnapshots!: EntityTable<NetWorthSnapshot, 'id'>

  constructor() {
    super('MyFinanceDB')
    this.version(1).stores({
      categories:             '++id, type, name',
      transactions:           '++id, date, type, categoryId, currency',
      investmentHoldings:     '++id, symbol, assetType',
      investmentPriceHistory: '++id, holdingId, date',
      mortgages:              '++id, isActive',
      mortgagePayments:       '++id, mortgageId, paymentDate',
      savingsGoals:           '++id, isCompleted',
      goalContributions:      '++id, goalId, date',
      netWorthSnapshots:      '++id, snapshotDate',
    })

    // v2: add Loan category if missing
    this.version(2).stores({}).upgrade(async tx => {
      const exists = await tx.table('categories').where('name').equals('Loan').count()
      if (exists === 0) {
        await tx.table('categories').add({
          name: 'Loan', icon: '🏦', color: '#0f766e', type: 'expense', isSystem: true,
        })
      }
    })

    // v3: add Rent and Mortgage categories if missing
    this.version(3).stores({}).upgrade(async tx => {
      const toAdd = [
        { name: 'Rent',     icon: '🔑', color: '#b45309', type: 'expense', isSystem: true },
        { name: 'Mortgage', icon: '🏠', color: '#7c3aed', type: 'expense', isSystem: true },
      ]
      for (const cat of toAdd) {
        const exists = await tx.table('categories').where('name').equals(cat.name).count()
        if (exists === 0) await tx.table('categories').add(cat)
      }
    })
  }
}

export const db = new MyFinanceDB()

// Seed default categories on first run
db.on('ready', async () => {
  const count = await db.categories.count()
  if (count === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES as Category[])
  }
})
