import type { Category, ExpenseTier } from '@/types'

export type { ExpenseTier }

export interface TierMeta {
  key: ExpenseTier
  label: string
  icon: string
  color: string
  desc: string
}

/**
 * Expense quality tiers, shown on the Analysis page. The idea: not all
 * spending is equal — money toward debt/equity/investing builds your future,
 * essentials keep the lights on, and lifestyle is discretionary.
 */
export const TIERS: TierMeta[] = [
  { key: 'wealth',    label: 'Wealth-building', icon: '💪', color: '#10b981', desc: 'Mortgage, loan payments, investments — builds net worth' },
  { key: 'essential', label: 'Essential',       icon: '🛡️', color: '#3b82f6', desc: 'Rent, utilities, insurance, health — necessary living costs' },
  { key: 'lifestyle', label: 'Lifestyle',       icon: '🎉', color: '#f59e0b', desc: 'Dining, entertainment, shopping, travel — discretionary' },
]

export const tierMeta = (key: ExpenseTier): TierMeta => TIERS.find(t => t.key === key)!

/** Default tier per built-in category name (used until a category is reclassified). */
export const DEFAULT_TIER_BY_NAME: Record<string, ExpenseTier> = {
  Mortgage: 'wealth',
  Loan: 'wealth',
  Investments: 'wealth',
  Rent: 'essential',
  Housing: 'essential',
  Utilities: 'essential',
  Insurance: 'essential',
  Health: 'essential',
  Transport: 'essential',
  Education: 'essential',
  'Other Expense': 'essential',
  'Food & Dining': 'lifestyle',
  Shopping: 'lifestyle',
  Entertainment: 'lifestyle',
  Travel: 'lifestyle',
  Subscriptions: 'lifestyle',
}

/** Resolve a category's tier: explicit override → name default → 'essential'. */
export function tierOf(cat?: Pick<Category, 'name' | 'tier'>): ExpenseTier {
  if (!cat) return 'essential'
  return cat.tier ?? DEFAULT_TIER_BY_NAME[cat.name] ?? 'essential'
}

/** Effective tier for a transaction: its own override, else its category's tier. */
export function resolveTier(txnTier: ExpenseTier | undefined, cat?: Pick<Category, 'name' | 'tier'>): ExpenseTier {
  return txnTier ?? tierOf(cat)
}
