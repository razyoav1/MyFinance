import { useState } from 'react'
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown } from 'lucide-react'
import { useTransactions, deleteTransaction, useMonthlyStats, TransactionFilters } from '@/hooks/useTransactions'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { TransactionForm } from './TransactionForm'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Transaction } from '@/types'
import { formatCurrency } from '@/lib/currency'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function Transactions() {
  const now = new Date()
  const [filters, setFilters] = useState<TransactionFilters>({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    type: 'all',
  })
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | undefined>()

  const debouncedSearch = search // simple - no debounce needed for local
  const transactions = useTransactions({ ...filters, search: debouncedSearch })
  const stats = useMonthlyStats(filters.year, filters.month)
  const categories = useLiveQuery(() => db.categories.toArray()) ?? []
  const catMap = Object.fromEntries(categories.map(c => [c.id!, c]))

  const set = (k: keyof TransactionFilters, v: unknown) =>
    setFilters(f => ({ ...f, [k]: v }))

  const handleEdit = (t: Transaction) => {
    setEditing(t)
    setFormOpen(true)
  }
  const handleAdd = () => {
    setEditing(undefined)
    setFormOpen(true)
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[var(--color-text)]">Transactions</h1>
        <Button onClick={handleAdd} size="sm">
          <Plus size={14} /> Add
        </Button>
      </div>

      {/* Monthly stats strip */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Income', value: stats.income, icon: TrendingUp, color: 'text-emerald-500' },
          { label: 'Expenses', value: stats.expenses, icon: TrendingDown, color: 'text-red-500' },
          { label: 'Net', value: stats.net, color: stats.net >= 0 ? 'text-emerald-500' : 'text-red-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center">
            <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
            <p className={`font-bold text-base ${color}`}>{formatCurrency(value, filters.year ? 'ILS' : 'ILS')}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Select
          value={filters.month}
          onChange={e => set('month', parseInt(e.target.value))}
          className="w-24"
        >
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </Select>
        <Select
          value={filters.year}
          onChange={e => set('year', parseInt(e.target.value))}
          className="w-24"
        >
          {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
        <Select
          value={filters.type ?? 'all'}
          onChange={e => set('type', e.target.value as 'income' | 'expense' | 'all')}
          className="w-28"
        >
          <option value="all">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </Select>
        <Input
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-40"
        />
      </div>

      {/* Table */}
      {transactions.length === 0 ? (
        <EmptyState
          icon="💸"
          title="No transactions"
          description="Add your first transaction to get started."
          action={<Button onClick={handleAdd} size="sm"><Plus size={14} /> Add Transaction</Button>}
        />
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface2)]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase hidden md:table-cell">Tags</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase">Amount</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => {
                  const cat = t.categoryId ? catMap[t.categoryId] : undefined
                  return (
                    <tr
                      key={t.id}
                      className={`border-b border-[var(--color-border)] hover:bg-[var(--color-surface2)] transition-colors ${i === transactions.length - 1 ? 'border-b-0' : ''}`}
                    >
                      <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">{t.date}</td>
                      <td className="px-4 py-3 font-medium text-[var(--color-text)]">
                        {t.description}
                        {t.isRecurring && (
                          <span className="ml-2 text-xs text-[var(--color-text-muted)]">↻</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {cat && (
                          <Badge color={cat.color}>{cat.icon} {cat.name}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {t.tags.map(tag => (
                            <Badge key={tag} variant="neutral">{tag}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
                        t.type === 'income' ? 'text-emerald-500' : 'text-red-500'
                      }`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, t.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(t)}
                            className="p-1.5 rounded hover:bg-[var(--color-surface2)] text-[var(--color-text-muted)] transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => t.id && deleteTransaction(t.id)}
                            className="p-1.5 rounded hover:bg-red-500/15 text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <TransactionForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(undefined) }} editing={editing} />
    </div>
  )
}
