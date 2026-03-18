import { AmortizationRow } from '@/types'
import { addMonths, format } from 'date-fns'

export function calcMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (annualRate === 0) return principal / termMonths
  const r = annualRate / 100 / 12
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1)
}

export function buildAmortizationSchedule(params: {
  principal: number
  annualRate: number
  termMonths: number
  startDate: string
  extraPayment?: number
}): AmortizationRow[] {
  const { principal, annualRate, termMonths, startDate, extraPayment = 0 } = params
  const monthlyRate = annualRate / 100 / 12
  const basePayment = calcMonthlyPayment(principal, annualRate, termMonths)
  const rows: AmortizationRow[] = []
  let balance = principal
  let start = new Date(startDate)

  for (let i = 0; i < termMonths && balance > 0.01; i++) {
    const interest = balance * monthlyRate
    const principalPaid = Math.min(basePayment - interest + extraPayment, balance)
    balance = Math.max(0, balance - principalPaid)
    rows.push({
      month: i + 1,
      date: format(addMonths(start, i), 'yyyy-MM-dd'),
      payment: basePayment + extraPayment,
      principal: principalPaid,
      interest,
      balance,
    })
    if (balance === 0) break
  }
  return rows
}

export function calcRemainingBalance(
  original: number,
  annualRate: number,
  termMonths: number,
  monthsPaid: number
): number {
  if (annualRate === 0) return original - (original / termMonths) * monthsPaid
  const r = annualRate / 100 / 12
  const payment = calcMonthlyPayment(original, annualRate, termMonths)
  return original * Math.pow(1 + r, monthsPaid) - payment * ((Math.pow(1 + r, monthsPaid) - 1) / r)
}
