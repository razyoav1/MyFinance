import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CurrencyStore {
  baseCurrency: string
  exchangeRates: Record<string, number>
  setBaseCurrency: (currency: string) => void
  setRate: (from: string, to: string, rate: number) => void
  convert: (amount: number, from: string) => number
}

export const useCurrencyStore = create<CurrencyStore>()(
  persist(
    (set, get) => ({
      baseCurrency: 'ILS',
      exchangeRates: {
        USD_ILS: 3.7,
        EUR_ILS: 4.0,
        GBP_ILS: 4.7,
      },
      setBaseCurrency: (currency) => set({ baseCurrency: currency }),
      setRate: (from, to, rate) =>
        set((s) => ({
          exchangeRates: { ...s.exchangeRates, [`${from}_${to}`]: rate },
        })),
      convert: (amount, from) => {
        const { baseCurrency, exchangeRates } = get()
        if (from === baseCurrency) return amount
        const key = `${from}_${baseCurrency}`
        const rate = exchangeRates[key]
        if (rate) return amount * rate
        const rev = exchangeRates[`${baseCurrency}_${from}`]
        if (rev) return amount / rev
        return amount
      },
    }),
    { name: 'currency-prefs' }
  )
)
