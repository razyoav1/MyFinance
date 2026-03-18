import { useState } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { useGoals, addGoal, updateGoal, deleteGoal, addContribution, useGoalContributions } from '@/hooks/useGoals'
import { SavingsGoal } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/currency'
import { CURRENCIES } from '@/types'
import { format, differenceInMonths, parseISO } from 'date-fns'

const GOAL_ICONS = ['🎯','🏖️','🚗','🏠','💍','✈️','🎓','💻','🐾','🎸','⛵','🌍']
const GOAL_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899','#8b5cf6','#14b8a6']

const defaultForm = {
  name: '', targetAmount: '', currency: 'ILS', targetDate: '',
  icon: '🎯', color: '#6366f1', currentAmount: '0',
}

export function Goals() {
  const goals = useGoals()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SavingsGoal | undefined>()
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  const [contribOpen, setContribOpen] = useState(false)
  const [contribGoal, setContribGoal] = useState<SavingsGoal | undefined>()
  const [contribAmount, setContribAmount] = useState('')
  const [contribNote, setContribNote] = useState('')

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const openAdd = () => { setEditing(undefined); setForm(defaultForm); setFormOpen(true) }
  const openEdit = (g: SavingsGoal) => {
    setEditing(g)
    setForm({
      name: g.name, targetAmount: String(g.targetAmount), currency: g.currency,
      targetDate: g.targetDate ?? '', icon: g.icon, color: g.color, currentAmount: String(g.currentAmount),
    })
    setFormOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const data: Omit<SavingsGoal, 'id'> = {
      name: form.name, targetAmount: parseFloat(form.targetAmount),
      currentAmount: parseFloat(form.currentAmount) || 0,
      currency: form.currency, targetDate: form.targetDate || undefined,
      icon: form.icon, color: form.color, isCompleted: false,
    }
    if (editing?.id) await updateGoal(editing.id, data)
    else await addGoal(data)
    setSaving(false)
    setFormOpen(false)
  }

  const openContrib = (g: SavingsGoal) => { setContribGoal(g); setContribAmount(''); setContribNote(''); setContribOpen(true) }
  const handleContrib = async () => {
    if (!contribGoal?.id || !contribAmount) return
    await addContribution(contribGoal.id, parseFloat(contribAmount), format(new Date(), 'yyyy-MM-dd'), contribNote || undefined)
    setContribOpen(false)
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[var(--color-text)]">Savings Goals</h1>
        <Button onClick={openAdd} size="sm"><Plus size={14} /> New Goal</Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="No savings goals yet"
          description="Set a target and track your progress towards it."
          action={<Button onClick={openAdd} size="sm"><Plus size={14} /> Create Goal</Button>}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {goals.map(goal => {
            const pct = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0
            const remaining = goal.targetAmount - goal.currentAmount
            const monthsLeft = goal.targetDate
              ? Math.max(1, differenceInMonths(parseISO(goal.targetDate), new Date()))
              : null
            const monthlyNeeded = monthsLeft ? remaining / monthsLeft : null

            return (
              <div key={goal.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{goal.icon}</span>
                    <div>
                      <h3 className="font-semibold text-[var(--color-text)]">{goal.name}</h3>
                      {goal.targetDate && (
                        <p className="text-xs text-[var(--color-text-muted)]">Target: {goal.targetDate}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openContrib(goal)} className="p-1.5 rounded hover:bg-[var(--color-surface2)] text-[var(--color-primary)] text-xs font-medium">+ Add</button>
                    <button onClick={() => openEdit(goal)} className="p-1.5 rounded hover:bg-[var(--color-surface2)] text-[var(--color-text-muted)]"><Pencil size={13} /></button>
                    <button onClick={() => goal.id && deleteGoal(goal.id)} className="p-1.5 rounded hover:bg-red-500/15 text-[var(--color-text-muted)] hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                </div>

                <ProgressBar value={pct} color={goal.color} />

                <div className="flex justify-between text-sm mt-2">
                  <span className="font-semibold text-[var(--color-text)]">{formatCurrency(goal.currentAmount, goal.currency)}</span>
                  <span className="text-[var(--color-text-muted)]">{formatCurrency(goal.targetAmount, goal.currency)}</span>
                </div>

                <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
                  <span>{pct.toFixed(0)}% complete</span>
                  {monthlyNeeded !== null && (
                    <span>{formatCurrency(monthlyNeeded, goal.currency)}/mo needed</span>
                  )}
                </div>

                {goal.isCompleted && (
                  <p className="text-xs text-emerald-500 mt-2 font-medium">✅ Goal achieved!</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Goal Modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Goal' : 'New Savings Goal'}>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">Icon</label>
              <div className="flex flex-wrap gap-1 max-w-40">
                {GOAL_ICONS.map(icon => (
                  <button key={icon} onClick={() => setF('icon', icon)}
                    className={`text-xl p-1 rounded ${form.icon === icon ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
                  >{icon}</button>
                ))}
              </div>
            </div>
            <Input label="Goal Name" placeholder="Emergency Fund" value={form.name} onChange={e => setF('name', e.target.value)} className="flex-1" />
          </div>

          <div className="flex gap-2">
            <Input label="Target Amount" type="number" step="100" value={form.targetAmount} onChange={e => setF('targetAmount', e.target.value)} className="flex-1" />
            <Select label="Currency" value={form.currency} onChange={e => setF('currency', e.target.value)} className="w-24">
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
            </Select>
          </div>
          <div className="flex gap-2">
            <Input label="Current Amount" type="number" step="100" value={form.currentAmount} onChange={e => setF('currentAmount', e.target.value)} className="flex-1" />
            <Input label="Target Date (optional)" type="date" value={form.targetDate} onChange={e => setF('targetDate', e.target.value)} className="flex-1" />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Color</label>
            <div className="flex gap-2 mt-1">
              {GOAL_COLORS.map(color => (
                <button key={color} onClick={() => setF('color', color)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === color ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !form.name || !form.targetAmount}>
              {saving ? 'Saving...' : editing ? 'Save' : 'Create Goal'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add contribution modal */}
      <Modal open={contribOpen} onClose={() => setContribOpen(false)} title={`Add to "${contribGoal?.name}"`} size="sm">
        <div className="flex flex-col gap-3">
          <Input
            label="Amount"
            type="number"
            step="10"
            value={contribAmount}
            onChange={e => setContribAmount(e.target.value)}
            placeholder="500"
          />
          <Input
            label="Note (optional)"
            value={contribNote}
            onChange={e => setContribNote(e.target.value)}
            placeholder="Monthly savings deposit"
          />
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setContribOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleContrib} disabled={!contribAmount}>Add</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
