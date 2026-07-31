import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { addTransaction, updateTransaction } from '@/hooks/useTransactions'
import { Transaction, CURRENCIES, ExpenseTier } from '@/types'
import { TIERS, tierOf, tierMeta } from '@/lib/tiers'
import { format } from 'date-fns'

interface Props {
  open: boolean
  onClose: () => void
  editing?: Transaction
  onSaved?: () => void
}

const defaultForm = {
  type: 'expense' as 'income' | 'expense',
  amount: '',
  currency: 'ILS',
  categoryId: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  description: '',
  notes: '',
  tags: '',
  isRecurring: false,
  recurringInterval: 'monthly' as Transaction['recurringInterval'],
  tier: '' as '' | ExpenseTier,
}

export function TransactionForm({ open, onClose, editing, onSaved }: Props) {
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  const categories = useLiveQuery(() => db.categories.toArray()) ?? []
  const filtered = categories
    .filter(c => c.type === form.type || c.type === 'both')
    .sort((a, b) => a.name.localeCompare(b.name))
  const selectedCat = categories.find(c => String(c.id) === form.categoryId)
  const defaultTierMeta = tierMeta(tierOf(selectedCat))

  useEffect(() => {
    if (editing) {
      setForm({
        type: editing.type,
        amount: String(editing.amount),
        currency: editing.currency,
        categoryId: String(editing.categoryId ?? ''),
        date: editing.date,
        description: editing.description,
        notes: editing.notes ?? '',
        tags: editing.tags.join(', '),
        isRecurring: editing.isRecurring,
        recurringInterval: editing.recurringInterval ?? 'monthly',
        tier: editing.tier ?? '',
      })
    } else {
      setForm(defaultForm)
    }
  }, [editing, open])

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.amount || !form.description) return
    setSaving(true)
    const data = {
      type: form.type,
      amount: parseFloat(form.amount),
      currency: form.currency,
      categoryId: form.categoryId ? parseInt(form.categoryId) : undefined,
      date: form.date,
      description: form.description,
      notes: form.notes || undefined,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      isRecurring: form.isRecurring,
      recurringInterval: form.isRecurring ? form.recurringInterval : undefined,
      tier: form.type === 'expense' && form.tier ? form.tier : undefined,
    }
    if (editing?.id) {
      await updateTransaction(editing.id, data)
    } else {
      await addTransaction(data)
    }
    setSaving(false)
    onSaved?.()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Transaction' : 'Add Transaction'} size="lg">
      <div className="flex flex-col gap-3">
        {/* Type toggle */}
        <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)]">
          {(['expense', 'income'] as const).map(t => (
            <button
              key={t}
              onClick={() => set('type', t)}
              className={`flex-1 py-2 text-sm font-medium capitalize transition-colors ${
                form.type === t
                  ? t === 'expense'
                    ? 'bg-red-500 text-white'
                    : 'bg-emerald-500 text-white'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Amount + Currency + Date */}
        <div className="flex gap-2">
          <Input
            label="Amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={form.amount}
            onChange={e => set('amount', e.target.value)}
            className="flex-1"
          />
          <Select
            label="Currency"
            value={form.currency}
            onChange={e => set('currency', e.target.value)}
            className="w-20"
          >
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.code}</option>
            ))}
          </Select>
          <Input
            label="Date"
            type="date"
            value={form.date}
            onChange={e => set('date', e.target.value)}
            className="w-40"
          />
        </div>

        <Input
          label="Description"
          placeholder="What was this for?"
          value={form.description}
          onChange={e => set('description', e.target.value)}
        />

        {/* Category + Quality (expense) */}
        <div className={`grid gap-2 ${form.type === 'expense' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <Select
            label="Category"
            value={form.categoryId}
            onChange={e => set('categoryId', e.target.value)}
          >
            <option value="">Select category...</option>
            {filtered.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </Select>
          {form.type === 'expense' && (
            <Select
              label="Quality (for Analysis)"
              value={form.tier}
              onChange={e => set('tier', e.target.value)}
            >
              <option value="">Follows category ({defaultTierMeta.icon} {defaultTierMeta.label})</option>
              {TIERS.map(t => (
                <option key={t.key} value={t.key}>{t.icon} {t.label}</option>
              ))}
            </Select>
          )}
        </div>

        {/* Tags + Notes */}
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Tags (comma separated)"
            placeholder="groceries, work..."
            value={form.tags}
            onChange={e => set('tags', e.target.value)}
          />
          <Textarea
            label="Notes"
            rows={2}
            placeholder="Optional notes..."
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
          />
        </div>

        {/* Recurring */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="recurring"
            checked={form.isRecurring}
            onChange={e => set('isRecurring', e.target.checked)}
            className="w-4 h-4 accent-[var(--color-primary)]"
          />
          <label htmlFor="recurring" className="text-sm text-[var(--color-text)]">Recurring</label>
          {form.isRecurring && (
            <Select
              value={form.recurringInterval}
              onChange={e => set('recurringInterval', e.target.value)}
              className="ml-auto w-32"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={saving || !form.amount || !form.description}>
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Transaction'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
