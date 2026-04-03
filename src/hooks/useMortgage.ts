import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Mortgage, MortgagePayment } from '@/types'
import { buildAmortizationSchedule } from '@/lib/mortgageCalc'
import { useRefresh } from '@/contexts/RefreshContext'

function mapMortgage(row: Record<string, any>): Mortgage {
  return {
    id: row.id,
    propertyName: row.property_name ?? '',
    originalAmount: Number(row.original_amount),
    currency: row.currency ?? 'ILS',
    interestRate: Number(row.annual_rate),
    termMonths: Number(row.term_months),
    startDate: row.start_date,
    monthlyPayment: 0, // computed client-side from amortization schedule
    extraMonthlyPayment: Number(row.extra_payment ?? 0),
    rateType: 'fixed',
    notes: row.notes ?? undefined,
    isActive: row.is_active ?? true,
  }
}

function mapMortgagePayment(row: Record<string, any>): MortgagePayment {
  return {
    id: row.id,
    mortgageId: row.mortgage_id,
    paymentDate: row.payment_date,
    totalPaid: Number(row.amount),
    principalPaid: Number(row.principal_portion ?? 0),
    interestPaid: Number(row.interest_portion ?? 0),
    balanceAfter: 0, // not stored, will be computed
  }
}

function mortgageToDb(data: Omit<Mortgage, 'id'>, userId: string) {
  return {
    user_id: userId,
    property_name: data.propertyName,
    original_amount: data.originalAmount,
    annual_rate: data.interestRate,
    term_months: data.termMonths,
    start_date: data.startDate,
    extra_payment: data.extraMonthlyPayment,
    is_active: data.isActive,
    currency: data.currency,
    notes: data.notes ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function getUserId(): Promise<string | null> {
  return supabase.auth.getSession().then(({ data: { session } }) => session?.user?.id ?? null)
}

export function useMortgage() {
  const [data, setData] = useState<Mortgage | undefined>(undefined)
  const { refreshKey } = useRefresh()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!userId) return
    const fetchData = async () => {
      const { data: rows } = await supabase
        .from('mortgages')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)

      if (!rows || rows.length === 0) { setData(undefined); return }
      setData(mapMortgage(rows[0]))
    }
    fetchData()
  }, [userId, refreshKey])

  return data
}

export function useMortgagePayments(mortgageId?: number) {
  const [data, setData] = useState<MortgagePayment[]>([])
  const { refreshKey } = useRefresh()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!userId || !mortgageId) { setData([]); return }
    const fetchData = async () => {
      const { data: rows } = await supabase
        .from('mortgage_payments')
        .select('*')
        .eq('user_id', userId)
        .eq('mortgage_id', mortgageId)
        .order('payment_date', { ascending: true })

      setData((rows ?? []).map(mapMortgagePayment))
    }
    fetchData()
  }, [userId, mortgageId, refreshKey])

  return data
}

export function useMortgageSummary() {
  const [data, setData] = useState<any>(null)
  const { refreshKey } = useRefresh()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!userId) return
    const fetchData = async () => {
      const { data: mortgageRows } = await supabase
        .from('mortgages')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)

      if (!mortgageRows || mortgageRows.length === 0) { setData(null); return }

      const mortgage = mapMortgage(mortgageRows[0])

      const { data: paymentRows } = await supabase
        .from('mortgage_payments')
        .select('*')
        .eq('user_id', userId)
        .eq('mortgage_id', mortgage.id!)
        .order('payment_date', { ascending: true })

      const payments = (paymentRows ?? []).map(mapMortgagePayment)

      const totalPaid = payments.reduce((s, p) => s + p.totalPaid, 0)
      const totalInterestPaid = payments.reduce((s, p) => s + p.interestPaid, 0)
      const totalPrincipalPaid = payments.reduce((s, p) => s + p.principalPaid, 0)

      // Compute running balance
      let runningBalance = mortgage.originalAmount
      for (const p of payments) {
        runningBalance -= p.principalPaid
      }
      const currentBalance = payments.length > 0 ? runningBalance : mortgage.originalAmount

      const monthsPaid = payments.length
      const monthsRemaining = mortgage.termMonths - monthsPaid

      const schedule = buildAmortizationSchedule({
        principal: currentBalance,
        annualRate: mortgage.interestRate,
        termMonths: monthsRemaining,
        startDate: new Date().toISOString().split('T')[0],
        extraPayment: mortgage.extraMonthlyPayment,
      })

      const totalInterestRemaining = schedule.reduce((s, r) => s + r.interest, 0)

      setData({
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
      })
    }
    fetchData()
  }, [userId, refreshKey])

  return data
}

export async function addMortgage(data: Omit<Mortgage, 'id'>) {
  const userId = await getUserId()
  if (!userId) throw new Error('Not authenticated')
  const { error } = await supabase.from('mortgages').insert(mortgageToDb(data, userId))
  if (error) throw error
}

export async function updateMortgage(id: number, data: Partial<Mortgage>) {
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  if (data.propertyName !== undefined) updateData.property_name = data.propertyName
  if (data.originalAmount !== undefined) updateData.original_amount = data.originalAmount
  if (data.interestRate !== undefined) updateData.annual_rate = data.interestRate
  if (data.termMonths !== undefined) updateData.term_months = data.termMonths
  if (data.startDate !== undefined) updateData.start_date = data.startDate
  if (data.extraMonthlyPayment !== undefined) updateData.extra_payment = data.extraMonthlyPayment
  if (data.isActive !== undefined) updateData.is_active = data.isActive
  if (data.currency !== undefined) updateData.currency = data.currency
  if (data.notes !== undefined) updateData.notes = data.notes

  const { error } = await supabase.from('mortgages').update(updateData).eq('id', id)
  if (error) throw error
}

export async function logMortgagePayment(data: Omit<MortgagePayment, 'id'>) {
  const userId = await getUserId()
  if (!userId) throw new Error('Not authenticated')
  const { error } = await supabase.from('mortgage_payments').insert({
    user_id: userId,
    mortgage_id: data.mortgageId,
    payment_date: data.paymentDate,
    amount: data.totalPaid,
    principal_portion: data.principalPaid,
    interest_portion: data.interestPaid,
    created_at: new Date().toISOString(),
  })
  if (error) throw error
}
