import { Category } from '@/types'

export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  // ── Expenses (alphabetical) ──
  { name: 'Donation',        icon: '🎗️', color: '#f43f5e', type: 'expense', isSystem: true, tier: 'good' },
  { name: 'Education',       icon: '📚', color: '#06b6d4', type: 'expense', isSystem: true, tier: 'good' },
  { name: 'Entertainment',   icon: '🎬', color: '#8b5cf6', type: 'expense', isSystem: true, tier: 'lifestyle' },
  { name: 'Gifting',         icon: '🎁', color: '#ec4899', type: 'expense', isSystem: true, tier: 'lifestyle' },
  { name: 'Going out',       icon: '🍸', color: '#f59e0b', type: 'expense', isSystem: true, tier: 'lifestyle' },
  { name: 'Groceries',       icon: '🛒', color: '#eab308', type: 'expense', isSystem: true, tier: 'essential' },
  { name: 'Health',          icon: '💊', color: '#ef4444', type: 'expense', isSystem: true, tier: 'essential' },
  { name: 'Housing',         icon: '🏠', color: '#6366f1', type: 'expense', isSystem: true, tier: 'essential' },
  { name: 'Insurance',       icon: '🛡️', color: '#64748b', type: 'expense', isSystem: true, tier: 'essential' },
  { name: 'Investment',      icon: '💹', color: '#10b981', type: 'expense', isSystem: true, tier: 'wealth' },
  { name: 'Loan',            icon: '🏦', color: '#0f766e', type: 'expense', isSystem: true, tier: 'good' },
  { name: 'Mortgage',        icon: '🏡', color: '#7c3aed', type: 'expense', isSystem: true, tier: 'wealth' },
  { name: 'Other Expenses',  icon: '📦', color: '#94a3b8', type: 'expense', isSystem: true, tier: 'essential' },
  { name: 'Pet',             icon: '🐾', color: '#d97706', type: 'expense', isSystem: true, tier: 'essential' },
  { name: 'Rent',            icon: '🔑', color: '#b45309', type: 'expense', isSystem: true, tier: 'essential' },
  { name: 'Self development', icon: '🧠', color: '#a855f7', type: 'expense', isSystem: true, tier: 'good' },
  { name: 'Shopping',        icon: '🛍️', color: '#db2777', type: 'expense', isSystem: true, tier: 'lifestyle' },
  { name: 'Subscription',    icon: '🔄', color: '#0ea5e9', type: 'expense', isSystem: true, tier: 'lifestyle' },
  { name: 'Transport',       icon: '🚌', color: '#3b82f6', type: 'expense', isSystem: true, tier: 'essential' },
  { name: 'Travel',          icon: '✈️', color: '#14b8a6', type: 'expense', isSystem: true, tier: 'lifestyle' },
  { name: 'Utilities',       icon: '⚡', color: '#f97316', type: 'expense', isSystem: true, tier: 'essential' },
  // ── Income (alphabetical) ──
  { name: 'Freelance',         icon: '💻', color: '#34d399', type: 'income', isSystem: true },
  { name: 'Investment return', icon: '📈', color: '#059669', type: 'income', isSystem: true },
  { name: 'Other Income',      icon: '💰', color: '#6ee7b7', type: 'income', isSystem: true },
  { name: 'Present',           icon: '🎀', color: '#f472b6', type: 'income', isSystem: true },
  { name: 'Rental Income',     icon: '🏘️', color: '#22c55e', type: 'income', isSystem: true },
  { name: 'Salary',            icon: '💼', color: '#10b981', type: 'income', isSystem: true },
]
