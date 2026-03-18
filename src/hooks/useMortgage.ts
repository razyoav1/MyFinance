import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { Mortgage, MortgagePayment } from '@/types'
import { buildAmortizationSchedule } from '@/lib/mortgageCalc'
import { differenceInMonths } from 'date-fns'

export function useMortgage() {
  return useLiveQuery(() => db.mortgages.filter(m => m.isActive).first())
}

export function useMortgagePayments(mortgageId?: number) {
  return useLiveQuery(async () => {
    if (!mortgageId) return []
    return db.mortgagePayments
      .where('mortgageId').equals(mortgageId)
      .sortBy('paymentDate')
  }, [mortgageId]) ?? []
}

export function useMortgageSummary() {
  return useLiveQuery(async () => {
    const mortgage = await db.mortgages.filter(m => m.isActive).first()
    if (!mortgage) return null

    const payments = await db.mortgagePayments
      .where('mortgageId').equals(mortgage.id!).sortBy('paymentDate')

    const totalPaid = payments.reduce((s, p) => s + p.totalPaid, 0)
    const totalInterestPaid = payments.reduce((s, p) => s + p.interestPaid, 0)
    const totalPrincipalPaid = payments.reduce((s, p) => s + p.principalPaid, 0)
    const currentBalance = payments.length > 0
      ? payments[payments.length - 1].balanceAfter
      : mortgage.originalAmount

    const monthsPaid = payments.length
    const monthsRemaining = mortgage.termMonths - monthsPaid

    // Build remaining schedule
    const schedule = buildAmortizationSchedule({
      principal: currentBalance,
      annualRate: mortgage.interestRate,
      termMonths: monthsRemaining,
      startDate: new Date().toISOString().split('T')[0],
      extraPayment: mortgage.extraMonthlyPayment,
    })

    const totalInterestRemaining = schedule.reduce((s, r) => s + r.interest, 0)

    return {
      mortgage,
      currentBalance,
      totalPaid,
      totalInterestPaid,
      totalPrincipalPaid,
      monthsPaid,
      monthsRemaining,
      payoffDate: schedule.length > 0 ? schedule[schedule.length - 1].date : null,
      totalInterestRemaining,
      schedule,
    }
  })
}

export async function addMortgage(data: Omit<Mortgage, 'id'>) {
  return db.mortgages.add(data)
}

export async function updateMortgage(id: number, data: Partial<Mortgage>) {
  return db.mortgages.update(id, data)
}

export async function logMortgagePayment(data: Omit<MortgagePayment, 'id'>) {
  return db.mortgagePayments.add(data)
}
