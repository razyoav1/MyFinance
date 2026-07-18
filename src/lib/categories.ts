import { Category } from '@/types'

export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  // Expenses
  { name: 'Housing', icon: '🏠', color: '#6366f1', type: 'expense', isSystem: true, tier: 'essential' },
  { name: 'Food & Dining', icon: '🍔', color: '#f59e0b', type: 'expense', isSystem: true, tier: 'lifestyle' },
  { name: 'Transport', icon: '🚌', color: '#3b82f6', type: 'expense', isSystem: true, tier: 'essential' },
  { name: 'Health', icon: '💊', color: '#ef4444', type: 'expense', isSystem: true, tier: 'essential' },
  { name: 'Shopping', icon: '🛍️', color: '#ec4899', type: 'expense', isSystem: true, tier: 'lifestyle' },
  { name: 'Entertainment', icon: '🎬', color: '#8b5cf6', type: 'expense', isSystem: true, tier: 'lifestyle' },
  { name: 'Utilities', icon: '⚡', color: '#f97316', type: 'expense', isSystem: true, tier: 'essential' },
  { name: 'Education', icon: '📚', color: '#06b6d4', type: 'expense', isSystem: true, tier: 'essential' },
  { name: 'Travel', icon: '✈️', color: '#14b8a6', type: 'expense', isSystem: true, tier: 'lifestyle' },
  { name: 'Subscriptions', icon: '🔄', color: '#0ea5e9', type: 'expense', isSystem: true, tier: 'lifestyle' },
  { name: 'Insurance', icon: '🛡️', color: '#64748b', type: 'expense', isSystem: true, tier: 'essential' },
  { name: 'Loan',     icon: '🏦', color: '#0f766e', type: 'expense', isSystem: true, tier: 'wealth' },
  { name: 'Rent',     icon: '🔑', color: '#b45309', type: 'expense', isSystem: true, tier: 'essential' },
  { name: 'Mortgage', icon: '🏠', color: '#7c3aed', type: 'expense', isSystem: true, tier: 'wealth' },
  { name: 'Other Expense', icon: '📦', color: '#94a3b8', type: 'expense', isSystem: true, tier: 'essential' },
  // Income
  { name: 'Salary', icon: '💼', color: '#10b981', type: 'income', isSystem: true },
  { name: 'Freelance', icon: '💻', color: '#34d399', type: 'income', isSystem: true },
  { name: 'Investment Returns', icon: '📈', color: '#059669', type: 'income', isSystem: true },
  { name: 'Rental Income', icon: '🏘️', color: '#6ee7b7', type: 'income', isSystem: true },
  { name: 'Gift', icon: '🎁', color: '#a7f3d0', type: 'income', isSystem: true },
  { name: 'Other Income', icon: '💰', color: '#6ee7b7', type: 'income', isSystem: true },
]
