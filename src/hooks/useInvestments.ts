import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { InvestmentHolding, InvestmentPriceHistory } from '@/types'
import { calcInvestmentGain } from '@/lib/financeCalc'
import { useCurrencyStore } from '@/store/useCurrencyStore'
import { convertCurrency } from '@/lib/currency'
import { useRefresh } from '@/contexts/RefreshContext'

function mapHolding(row: Record<string, any>): InvestmentHolding {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    assetType: row.asset_type,
    quantity: Number(row.quantity),
    purchasePrice: Number(row.purchase_price),
    purchaseCurrency: row.currency ?? 'USD',
    purchaseDate: row.purchase_date ?? '',
    currentPrice: Number(row.current_price),
    currentCurrency: row.currency ?? 'USD',
    notes: row.notes ?? undefined,
    updatedAt: row.updated_at ?? '',
  }
}

function holdingToDb(data: Omit<InvestmentHolding, 'id'>, userId: string) {
  return {
    user_id: userId,
    symbol: data.symbol,
    name: data.name,
    asset_type: data.assetType,
    quantity: data.quantity,
    purchase_price: data.purchasePrice,
    current_price: data.currentPrice,
    currency: data.currentCurrency ?? data.purchaseCurrency ?? 'USD',
    purchase_date: data.purchaseDate ?? null,
    notes: data.notes ?? null,
    updated_at: data.updatedAt,
  }
}

function getUserId(): Promise<string | null> {
  return supabase.auth.getSession().then(({ data: { session } }) => session?.user?.id ?? null)
}

export function useInvestments() {
  const [data, setData] = useState<(InvestmentHolding & { costBasis: number; currentValue: number; gainAbsolute: number; gainPercent: number })[]>([])
  const { refreshKey } = useRefresh()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!userId) return
    const fetchData = async () => {
      const { data: rows } = await supabase
        .from('investment_holdings')
        .select('*')
        .eq('user_id', userId)

      if (!rows) { setData([]); return }

      setData(rows.map(row => {
        const h = mapHolding(row)
        const { absolute, percent } = calcInvestmentGain(h.quantity, h.purchasePrice, h.currentPrice)
        const costBasis = h.quantity * h.purchasePrice
        const currentValue = h.quantity * h.currentPrice
        return { ...h, costBasis, currentValue, gainAbsolute: absolute, gainPercent: percent }
      }))
    }
    fetchData()
  }, [userId, refreshKey])

  return data
}

// Portfolio totals are always expressed in USD.
// Holdings in other currencies (e.g. ILS) are converted to USD before summing.
export function usePortfolioTotal() {
  const rates = useCurrencyStore(s => s.exchangeRates)
  const [data, setData] = useState({ totalInvested: 0, totalCurrent: 0, gain: 0, gainPercent: 0 })
  const { refreshKey } = useRefresh()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!userId) return
    const fetchData = async () => {
      const { data: rows } = await supabase
        .from('investment_holdings')
        .select('*')
        .eq('user_id', userId)

      if (!rows) return

      const holdings = rows.map(mapHolding)
      const toUSD = (amount: number, currency: string) => convertCurrency(amount, currency, 'USD', rates)
      const totalInvested = holdings.reduce((s, h) => s + toUSD(h.quantity * h.purchasePrice, h.purchaseCurrency), 0)
      const totalCurrent = holdings.reduce((s, h) => s + toUSD(h.quantity * h.currentPrice, h.currentCurrency), 0)
      setData({
        totalInvested,
        totalCurrent,
        gain: totalCurrent - totalInvested,
        gainPercent: totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0,
      })
    }
    fetchData()
  }, [userId, rates, refreshKey])

  return data
}

export async function addInvestment(data: Omit<InvestmentHolding, 'id'>) {
  const userId = await getUserId()
  if (!userId) throw new Error('Not authenticated')
  const { error } = await supabase.from('investment_holdings').insert(holdingToDb(data, userId))
  if (error) throw error
}

export async function updateInvestment(id: number, data: Partial<InvestmentHolding>) {
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  if (data.symbol !== undefined) updateData.symbol = data.symbol
  if (data.name !== undefined) updateData.name = data.name
  if (data.assetType !== undefined) updateData.asset_type = data.assetType
  if (data.quantity !== undefined) updateData.quantity = data.quantity
  if (data.purchasePrice !== undefined) updateData.purchase_price = data.purchasePrice
  if (data.currentPrice !== undefined) updateData.current_price = data.currentPrice
  if (data.purchaseCurrency !== undefined || data.currentCurrency !== undefined) {
    updateData.currency = data.currentCurrency ?? data.purchaseCurrency
  }
  if (data.purchaseDate !== undefined) updateData.purchase_date = data.purchaseDate
  if (data.notes !== undefined) updateData.notes = data.notes

  const { error } = await supabase.from('investment_holdings').update(updateData).eq('id', id)
  if (error) throw error
}

export async function deleteInvestment(id: number) {
  const { error } = await supabase.from('investment_holdings').delete().eq('id', id)
  if (error) throw error
}

export async function updatePrice(id: number, price: number, currency: string) {
  const userId = await getUserId()
  if (!userId) throw new Error('Not authenticated')
  const today = new Date().toISOString().split('T')[0]

  await supabase.from('investment_holdings').update({
    current_price: price,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  // Upsert price history: check if entry exists for today
  const { data: existing } = await supabase
    .from('investment_price_history')
    .select('id')
    .eq('holding_id', id)
    .eq('date', today)
    .maybeSingle()

  if (existing?.id) {
    await supabase.from('investment_price_history').update({ price, currency }).eq('id', existing.id)
  } else {
    await supabase.from('investment_price_history').insert({
      user_id: userId,
      holding_id: id,
      price,
      currency,
      date: today,
    })
  }
}

export function usePortfolioHistory(holdingId?: number) {
  const rates = useCurrencyStore(s => s.exchangeRates)
  const [data, setData] = useState<any[]>([])
  const { refreshKey } = useRefresh()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!userId) return
    const fetchData = async () => {
      if (holdingId) {
        const { data: rows } = await supabase
          .from('investment_price_history')
          .select('*')
          .eq('user_id', userId)
          .eq('holding_id', holdingId)
          .order('date', { ascending: true })

        setData((rows ?? []).map(r => ({
          id: r.id,
          holdingId: r.holding_id,
          price: Number(r.price),
          currency: r.currency,
          date: r.date,
        } as InvestmentPriceHistory)))
      } else {
        // All holdings: aggregate by date, always converting to USD
        const { data: allHistory } = await supabase
          .from('investment_price_history')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: true })

        const { data: holdingRows } = await supabase
          .from('investment_holdings')
          .select('*')
          .eq('user_id', userId)

        const holdingMap: Record<number, InvestmentHolding> = {}
        for (const h of (holdingRows ?? [])) {
          holdingMap[h.id] = mapHolding(h)
        }

        const byDate: Record<string, number> = {}
        for (const p of (allHistory ?? [])) {
          const holding = holdingMap[p.holding_id]
          if (!holding) continue
          const currency = p.currency || holding.currentCurrency
          const valueUSD = convertCurrency(Number(p.price) * holding.quantity, currency, 'USD', rates)
          byDate[p.date] = (byDate[p.date] ?? 0) + valueUSD
        }

        setData(Object.entries(byDate)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, value]) => ({ date, value })))
      }
    }
    fetchData()
  }, [userId, holdingId, rates, refreshKey])

  return data
}
