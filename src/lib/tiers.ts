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
  { key: 'wealth',    label: 'Wealth building', icon: '💰', color: '#10b981', desc: 'Investments & mortgage — grows your assets / net worth' },
  { key: 'good',      label: 'Good',            icon: '💪', color: '#84cc16', desc: 'Education, self-development, good loans — beneficial, improves you' },
  { key: 'essential', label: 'Essential',       icon: '🛡️', color: '#3b82f6', desc: 'Rent, utilities, insurance, health, groceries — necessary living costs' },
  { key: 'lifestyle', label: 'Lifestyle',       icon: '🎉', color: '#f59e0b', desc: 'Going out, entertainment, shopping, travel — discretionary' },
]

export const tierMeta = (key: ExpenseTier): TierMeta => TIERS.find(t => t.key === key)!

/** Default tier per built-in category name (used until a category is reclassified). */
export const DEFAULT_TIER_BY_NAME: Record<string, ExpenseTier> = {
  // wealth building (grows assets)
  Investment: 'wealth',
  Mortgage: 'wealth',
  // good (beneficial, improves you)
  Education: 'good',
  'Self development': 'good',
  Loan: 'good',
  Donation: 'good',
  // essential
  Rent: 'essential',
  Housing: 'essential',
  Utilities: 'essential',
  Insurance: 'essential',
  Health: 'essential',
  Transport: 'essential',
  Groceries: 'essential',
  Pet: 'essential',
  'Other Expenses': 'essential',
  // lifestyle
  'Going out': 'lifestyle',
  Shopping: 'lifestyle',
  Entertainment: 'lifestyle',
  Travel: 'lifestyle',
  Subscription: 'lifestyle',
  Gifting: 'lifestyle',
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
