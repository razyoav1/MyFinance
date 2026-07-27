/** Quality tier for expense categories, used by the Analysis page. */
export type ExpenseTier = 'wealth' | 'good' | 'essential' | 'lifestyle'

export interface Category {
  id?: number
  name: string
  icon: string
  color: string
  type: 'income' | 'expense' | 'both'
  isSystem: boolean
  /** Only meaningful for expense categories; falls back to a name-based default. */
  tier?: ExpenseTier
}

export type TransactionSource = 'manual' | 'csv' | 'sync' | 'recurring'

export interface Transaction {
  id?: number
  type: 'income' | 'expense'
  amount: number
  currency: string
  categoryId?: number
  date: string        // YYYY-MM-DD
  description: string
  notes?: string
  tags: string[]
  isRecurring: boolean
  recurringInterval?: 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  createdAt: string
  updatedAt: string
  /** Stable id from an external provider (bank sync) — used to skip duplicates on re-sync */
  externalId?: string
  source?: TransactionSource
  /** Per-transaction quality override; when unset the category's tier applies. */
  tier?: ExpenseTier
}

export interface TransactionWithCategory extends Transaction {
  category?: Category
}

export interface InvestmentHolding {
  id?: number
  symbol: string
  name: string
  assetType: 'stock' | 'etf' | 'crypto' | 'other'
  quantity: number
  purchasePrice: number
  purchaseCurrency: string
  purchaseDate: string
  currentPrice: number
  currentCurrency: string
  notes?: string
  updatedAt: string
}

export interface InvestmentPriceHistory {
  id?: number
  holdingId: number
  price: number
  currency: string
  date: string
}

export interface Mortgage {
  id?: number
  propertyName: string
  originalAmount: number
  currency: string
  interestRate: number
  termMonths: number
  startDate: string
  monthlyPayment: number
  extraMonthlyPayment: number
  rateType: 'fixed' | 'variable'
  notes?: string
  isActive: boolean
}

export interface MortgagePayment {
  id?: number
  mortgageId: number
  paymentDate: string
  totalPaid: number
  principalPaid: number
  interestPaid: number
  balanceAfter: number
}

export interface SavingsGoal {
  id?: number
  name: string
  targetAmount: number
  currentAmount: number
  currency: string
  targetDate?: string
  icon: string
  color: string
  isCompleted: boolean
}

export interface GoalContribution {
  id?: number
  goalId: number
  amount: number
  date: string
  notes?: string
}

export interface NetWorthSnapshot {
  id?: number
  snapshotDate: string
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  currency: string
}

export type BankAccountType = 'checking' | 'savings' | 'credit' | 'cash'

export interface BankAccount {
  id?: number
  name: string
  type: BankAccountType
  balance: number       // positive = asset, negative = credit card debt
  currency: string
  icon: string
  notes?: string
  updatedAt: string
}

export interface AmortizationRow {
  month: number
  date: string
  payment: number
  principal: number
  interest: number
  balance: number
}

export type Currency = 'ILS' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | 'CHF'

export const CURRENCIES: { code: Currency; symbol: string; name: string }[] = [
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
]
