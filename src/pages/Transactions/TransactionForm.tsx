import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { addTransaction, updateTransaction } from '@/hooks/useTransactions'
import { Transaction, Category, CURRENCIES } from '@/types'
import { DEFAULT_CATEGORIES } from '@/lib/categories'
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
}

export function TransactionForm({ open, onClose, editing, onSaved }: Props) {
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!userId) return
    const loadCategories = async () => {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)

      // Auto-seed if empty (first login or schema was run after first login)
      if (!data || data.length === 0) {
        await supabase.from('categories').insert(
          DEFAULT_CATEGORIES.map(c => ({
            name: c.name, icon: c.icon, color: c.color,
            type: c.type, is_system: c.isSystem ?? false, user_id: userId,
          }))
        )
        const { data: seeded } = await supabase.from('categories').select('*').eq('user_id', userId)
        setCategories((seeded ?? []).map((row: any) => ({
          id: row.id, name: row.name, icon: row.icon,
          color: row.color, type: row.type, isSystem: row.is_system ?? false,
        })))
      } else {
        setCategories(data.map((row: any) => ({
          id: row.id, name: row.name, icon: row.icon,
          color: row.color, type: row.type, isSystem: row.is_system ?? false,
        })))
      }
    }
    loadCategories()
  }, [userId])

  const filtered = categories.filter(c => c.type === form.type || c.type === 'both')

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
      })
    } else {
      setForm(defaultForm)
    }
  }, [editing, open])

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.amount || !form.description) return
    setSaving(true)
    try {
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
      }
      if (editing?.id) {
        await updateTransaction(editing.id, data)
      } else {
        await addTransaction(data)
      }
      onSaved?.()
      onClose()
    } catch (err) {
      console.error('Failed to save transaction:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Transaction' : 'Add Transaction'}>
      <div className="flex flex-col gap-4">
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

        {/* Amount + Currency */}
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
            className="w-24"
          >
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.code}</option>
            ))}
          </Select>
        </div>

        <Input
          label="Description"
          placeholder="What was this for?"
          value={form.description}
          onChange={e => set('description', e.target.value)}
        />

        <div className="flex gap-2">
          <Select
            label="Category"
            value={form.categoryId}
            onChange={e => set('categoryId', e.target.value)}
            className="flex-1"
          >
            <option value="">Select category...</option>
            {filtered.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </Select>
          <Input
            label="Date"
            type="date"
            value={form.date}
            onChange={e => set('date', e.target.value)}
            className="w-36"
          />
        </div>

        <Input
          label="Tags (comma separated)"
          placeholder="groceries, weekly, work..."
          value={form.tags}
          onChange={e => set('tags', e.target.value)}
        />

        <Textarea
          label="Notes"
          placeholder="Optional notes..."
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
        />

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
