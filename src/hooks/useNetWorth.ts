import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { useCurrencyStore } from '@/store/useCurrencyStore'
import { usePortfolioTotal } from './useInvestments'
import { useMortgageSummary } from './useMortgage'
import { convertCurrency } from '@/lib/currency'

export function useNetWorth() {
  const { baseCurrency, exchangeRates } = useCurrencyStore()
  const portfolio = usePortfolioTotal()
  const mortgageSummary = useMortgageSummary()

  const bankAccounts = useLiveQuery(() => db.bankAccounts.toArray(), []) ?? []
  const goals = useLiveQuery(() => db.savingsGoals.filter(g => !g.isCompleted).toArray(), []) ?? []

  const toBase = (amount: number, currency: string) =>
    convertCurrency(amount, currency, baseCurrency, exchangeRates)

  // Sum all bank balances in baseCurrency
  const totalCash = bankAccounts.reduce((s, a) => s + toBase(a.balance, a.currency), 0)

  // Portfolio (totalCurrent is in USD) → baseCurrency
  const portfolioInBase = toBase(portfolio.totalCurrent, 'USD')

  // Mortgage liability → baseCurrency
  const mortgageLiability = mortgageSummary
    ? toBase(mortgageSummary.currentBalance, mortgageSummary.mortgage.currency)
    : 0

  // Sum of active goal currentAmounts → baseCurrency
  const totalAllocatedToGoals = goals.reduce((s, g) => s + toBase(g.currentAmount, g.currency), 0)

  const freeCash = totalCash - totalAllocatedToGoals
  const totalAssets = totalCash + portfolioInBase
  const totalLiabilities = mortgageLiability
  const netWorth = totalAssets - totalLiabilities

  return {
    totalCash,
    portfolioInBase,
    mortgageLiability,
    totalAllocatedToGoals,
    freeCash,
    totalAssets,
    totalLiabilities,
    netWorth,
    baseCurrency,
    bankAccounts,
    goals,
    mortgageSummary,
    portfolio,
    hasBankAccounts: bankAccounts.length > 0,
  }
}
