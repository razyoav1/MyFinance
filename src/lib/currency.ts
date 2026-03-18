export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function formatCompact(amount: number, currency: string): string {
  const abs = Math.abs(amount)
  let formatted: string
  if (abs >= 1_000_000) {
    formatted = (amount / 1_000_000).toFixed(1) + 'M'
  } else if (abs >= 1_000) {
    formatted = (amount / 1_000).toFixed(1) + 'K'
  } else {
    formatted = amount.toFixed(0)
  }
  const symbol = getCurrencySymbol(currency)
  return `${symbol}${formatted}`
}

export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    ILS: '₪', USD: '$', EUR: '€', GBP: '£',
    JPY: '¥', CAD: 'CA$', AUD: 'A$', CHF: 'Fr',
  }
  return symbols[currency] ?? currency
}

export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number {
  if (from === to) return amount
  const key = `${from}_${to}`
  const rate = rates[key]
  if (rate) return amount * rate
  // Try reverse
  const reverseKey = `${to}_${from}`
  const reverseRate = rates[reverseKey]
  if (reverseRate) return amount / reverseRate
  return amount // fallback: no conversion
}
