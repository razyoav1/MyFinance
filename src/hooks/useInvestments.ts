import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { InvestmentHolding, InvestmentPriceHistory } from '@/types'
import { calcInvestmentGain } from '@/lib/financeCalc'
import { useCurrencyStore } from '@/store/useCurrencyStore'
import { convertCurrency } from '@/lib/currency'

export function useInvestments() {
  return useLiveQuery(async () => {
    const holdings = await db.investmentHoldings.toArray()
    return holdings.map(h => {
      const { absolute, percent } = calcInvestmentGain(h.quantity, h.purchasePrice, h.currentPrice)
      const costBasis = h.quantity * h.purchasePrice
      const currentValue = h.quantity * h.currentPrice
      return { ...h, costBasis, currentValue, gainAbsolute: absolute, gainPercent: percent }
    })
  }) ?? []
}

// Portfolio totals are always expressed in USD.
// Holdings in other currencies (e.g. ILS) are converted to USD before summing.
export function usePortfolioTotal() {
  const rates = useCurrencyStore(s => s.exchangeRates)
  return useLiveQuery(async () => {
    const holdings = await db.investmentHoldings.toArray()
    const toUSD = (amount: number, currency: string) => convertCurrency(amount, currency, 'USD', rates)
    const totalInvested = holdings.reduce((s, h) => s + toUSD(h.quantity * h.purchasePrice, h.purchaseCurrency), 0)
    const totalCurrent  = holdings.reduce((s, h) => s + toUSD(h.quantity * h.currentPrice,  h.currentCurrency),  0)
    return {
      totalInvested,
      totalCurrent,
      gain: totalCurrent - totalInvested,
      gainPercent: totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0,
    }
  }, [rates]) ?? { totalInvested: 0, totalCurrent: 0, gain: 0, gainPercent: 0 }
}

export async function addInvestment(data: Omit<InvestmentHolding, 'id'>) {
  await db.investmentHoldings.add(data)
}

export async function updateInvestment(id: number, data: Partial<InvestmentHolding>) {
  await db.investmentHoldings.update(id, { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteInvestment(id: number) {
  await db.investmentHoldings.delete(id)
}

export async function updatePrice(id: number, price: number, currency: string) {
  const today = new Date().toISOString().split('T')[0]
  await db.investmentHoldings.update(id, { currentPrice: price, updatedAt: new Date().toISOString() })
  // Save price history (upsert)
  const existing = await db.investmentPriceHistory
    .where({ holdingId: id, date: today }).first()
  if (existing?.id) {
    await db.investmentPriceHistory.update(existing.id, { price, currency })
  } else {
    await db.investmentPriceHistory.add({ holdingId: id, price, currency, date: today })
  }
}

export function usePortfolioHistory(holdingId?: number) {
  const rates = useCurrencyStore(s => s.exchangeRates)
  return useLiveQuery(async () => {
    let history: InvestmentPriceHistory[]
    if (holdingId) {
      history = await db.investmentPriceHistory.where('holdingId').equals(holdingId).sortBy('date')
    } else {
      // All holdings: aggregate by date, always converting to USD
      const allHistory = await db.investmentPriceHistory.orderBy('date').toArray()
      const holdings = await db.investmentHoldings.toArray()
      const holdingMap = Object.fromEntries(holdings.map(h => [h.id!, h]))

      const byDate: Record<string, number> = {}
      for (const p of allHistory) {
        const holding = holdingMap[p.holdingId]
        if (!holding) continue
        const currency = p.currency || holding.currentCurrency
        const valueUSD = convertCurrency(p.price * holding.quantity, currency, 'USD', rates)
        byDate[p.date] = (byDate[p.date] ?? 0) + valueUSD
      }
      return Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date, value }))
    }
    return history
  }, [holdingId, rates]) ?? []
}
