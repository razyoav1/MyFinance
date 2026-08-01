import Dexie, { type EntityTable } from 'dexie'
import type {
  Category, Transaction, InvestmentHolding, InvestmentPriceHistory,
  Mortgage, MortgagePayment, SavingsGoal, GoalContribution, NetWorthSnapshot, BankAccount, Budget
} from '@/types'
import { DEFAULT_CATEGORIES } from '@/lib/categories'
import { DEFAULT_TIER_BY_NAME } from '@/lib/tiers'

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
  bankAccounts!: EntityTable<BankAccount, 'id'>
  budgets!: EntityTable<Budget, 'id'>

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

    // v4: update Transport icon from 🚗 to 🚌
    this.version(4).stores({}).upgrade(async tx => {
      const transport = await tx.table('categories').where('name').equals('Transport').first()
      if (transport && transport.icon === '🚗') {
        await tx.table('categories').update(transport.id, { icon: '🚌' })
      }
    })

    // v5: add bankAccounts table
    this.version(5).stores({
      bankAccounts: '++id, type, currency',
    })

    // v6: index transactions.externalId for bank-sync duplicate detection
    this.version(6).stores({
      transactions: '++id, date, type, categoryId, currency, externalId',
    })

    // v7: assign expense-quality tiers to existing categories
    this.version(7).stores({}).upgrade(async tx => {
      const cats = await tx.table('categories').toArray()
      for (const c of cats) {
        if (c.type !== 'income' && !c.tier) {
          const tier = DEFAULT_TIER_BY_NAME[c.name]
          if (tier) await tx.table('categories').update(c.id, { tier })
        }
      }
    })

    // v8: reorganize default categories — rename old names to the new set and
    // add the new categories. Renames keep the category id, so existing
    // transactions stay attached.
    this.version(8).stores({}).upgrade(async tx => {
      const table = tx.table('categories')
      const existing = await table.toArray()
      const byName: Record<string, any> = {}
      for (const c of existing) byName[c.name] = c

      const defaultByName: Record<string, Omit<Category, 'id'>> = {}
      for (const d of DEFAULT_CATEGORIES) defaultByName[d.name] = d

      const renames: Record<string, string> = {
        'Food & Dining': 'Groceries',
        'Subscriptions': 'Subscription',
        'Other Expense': 'Other Expenses',
        'Investment Returns': 'Investment return',
        'Gift': 'Present',
      }
      for (const [from, to] of Object.entries(renames)) {
        const cat = byName[from]
        if (cat && !byName[to]) {
          const def = defaultByName[to]
          await table.update(cat.id, {
            name: to,
            icon: def?.icon ?? cat.icon,
            color: def?.color ?? cat.color,
            ...(def && 'tier' in def ? { tier: def.tier } : {}),
          })
          byName[to] = { ...cat, name: to }
          delete byName[from]
        }
      }

      // Add any new default category that doesn't already exist by name
      for (const d of DEFAULT_CATEGORIES) {
        if (!byName[d.name]) {
          await table.add(d)
          byName[d.name] = d
        }
      }
    })

    // v9: split the old "Good"/wealth tier into "Wealth building" (assets) and
    // "Good" (beneficial). Move categories to the new 'good' tier only if they
    // still hold their previous default tier (don't override user choices).
    this.version(9).stores({}).upgrade(async tx => {
      const table = tx.table('categories')
      const moves = [
        { name: 'Loan',             from: 'wealth',    to: 'good' },
        { name: 'Education',        from: 'essential', to: 'good' },
        { name: 'Self development', from: 'essential', to: 'good' },
        { name: 'Donation',         from: 'lifestyle', to: 'good' },
      ]
      for (const m of moves) {
        const cat = await table.where('name').equals(m.name).first()
        if (cat && cat.tier === m.from) await table.update(cat.id, { tier: m.to })
      }
    })

    // v10: per-category monthly budgets (Budget planning page)
    this.version(10).stores({
      budgets: '++id, categoryId',
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
