import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCurrencyStore } from '@/store/useCurrencyStore'
import { usePortfolioTotal } from './useInvestments'
import { useMortgageSummary } from './useMortgage'
import { convertCurrency } from '@/lib/currency'
import { useRefresh } from '@/contexts/RefreshContext'
import { BankAccount, SavingsGoal } from '@/types'

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

export function useNetWorth() {
  const { baseCurrency, exchangeRates } = useCurrencyStore()
  const portfolio = usePortfolioTotal()
  const mortgageSummary = useMortgageSummary()
  const { refreshKey } = useRefresh()

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!userId) return
    const fetchData = async () => {
      const { data: accRows } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', userId)

      setBankAccounts((accRows ?? []).map(mapBankAccount))

      const { data: goalRows } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', userId)
        .eq('is_completed', false)

      setGoals((goalRows ?? []).map(mapGoal))
    }
    fetchData()
  }, [userId, refreshKey])

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
