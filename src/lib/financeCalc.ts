export function calcSavingsRate(income: number, expenses: number): number {
  if (income <= 0) return 0
  return Math.max(0, ((income - expenses) / income) * 100)
}

export function calcNetWorth(
  totalAssets: number,
  totalLiabilities: number
): number {
  return totalAssets - totalLiabilities
}

export function calcInvestmentGain(
  quantity: number,
  purchasePrice: number,
  currentPrice: number
): { absolute: number; percent: number } {
  const costBasis = quantity * purchasePrice
  const currentValue = quantity * currentPrice
  const absolute = currentValue - costBasis
  const percent = costBasis > 0 ? (absolute / costBasis) * 100 : 0
  return { absolute, percent }
}
