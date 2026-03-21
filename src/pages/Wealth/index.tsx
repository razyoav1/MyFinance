import { useState } from 'react'
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNetWorth } from '@/hooks/useNetWorth'
import { addBankAccount, updateBankAccount, deleteBankAccount } from '@/hooks/useBankAccounts'
import { BankAccount, BankAccountType, CURRENCIES } from '@/types'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { formatCurrency, formatCompact } from '@/lib/currency'
import { toast } from '@/store/useToastStore'

const ACCOUNT_ICONS = ['🏦', '💰', '💳', '🏧', '🐷', '💵', '🏢', '📱']

const ACCOUNT_TYPE_COLORS: Record<BankAccountType, string> = {
  checking: '#3b82f6',
  savings:  '#10b981',
  credit:   '#ef4444',
  cash:     '#f59e0b',
}

const defaultForm = {
  name: '', type: 'checking' as BankAccountType,
  balance: '', currency: 'ILS', icon: '🏦', notes: '',
}

export function Wealth() {
  const navigate = useNavigate()
  const nw = useNetWorth()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BankAccount | undefined>()
  const [deleting, setDeleting] = useState<BankAccount | undefined>()
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const openAdd = () => { setEditing(undefined); setForm(defaultForm); setModalOpen(true) }
  const openEdit = (a: BankAccount) => {
    setEditing(a)
    setForm({ name: a.name, type: a.type, balance: String(a.balance), currency: a.currency, icon: a.icon, notes: a.notes ?? '' })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || form.balance === '') return
    setSaving(true)
    const data: Omit<BankAccount, 'id'> = {
      name: form.name, type: form.type,
      balance: parseFloat(form.balance),
      currency: form.currency, icon: form.icon,
      notes: form.notes || undefined,
      updatedAt: new Date().toISOString(),
    }
    if (editing?.id) {
      await updateBankAccount(editing.id, data)
      toast.success('Account updated')
    } else {
      await addBankAccount(data)
      toast.success('Account added')
    }
    setSaving(false)
    setModalOpen(false)
  }

  const handleDelete = async () => {
    if (!deleting?.id) return
    await deleteBankAccount(deleting.id)
    toast.success('Account deleted')
  }

  // Goals allocation bar
  const totalForBar = Math.max(nw.totalCash, nw.totalAllocatedToGoals)
  const allocatedPct = totalForBar > 0 ? Math.min(100, (nw.totalAllocatedToGoals / totalForBar) * 100) : 0
  const freePct = 100 - allocatedPct

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-[var(--color-text)] mb-4">Wealth</h1>

      {/* Net Worth summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Net Worth',      value: nw.netWorth,      color: nw.netWorth >= 0 ? 'text-emerald-500' : 'text-red-500' },
          { label: 'Total Assets',   value: nw.totalAssets,   color: 'text-[var(--color-text)]' },
          { label: 'Total Liabilities', value: nw.totalLiabilities, color: nw.totalLiabilities > 0 ? 'text-red-500' : 'text-[var(--color-text-muted)]' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
            <p className={`font-bold text-2xl mt-1 ${color}`}>{formatCompact(value, nw.baseCurrency)}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{formatCurrency(value, nw.baseCurrency)}</p>
          </Card>
        ))}
      </div>

      {/* Middle row: Accounts + Investments */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">

        {/* Cash & Accounts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Cash & Accounts</CardTitle>
              <Button size="sm" onClick={openAdd}><Plus size={13} /> Add</Button>
            </div>
          </CardHeader>

          {nw.bankAccounts.length === 0 ? (
            <EmptyState
              icon="🏦"
              title="No accounts yet"
              description="Add your bank accounts, savings, or cash to track your total wealth."
              action={<Button size="sm" onClick={openAdd}><Plus size={13} /> Add Account</Button>}
            />
          ) : (
            <div className="flex flex-col gap-1">
              {nw.bankAccounts.map(a => (
                <div key={a.id} className="flex items-center gap-2 py-2 px-1 rounded-lg hover:bg-[var(--color-surface2)] group">
                  <span className="text-xl">{a.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">{a.name}</p>
                    <Badge color={ACCOUNT_TYPE_COLORS[a.type]} className="mt-0.5">{a.type}</Badge>
                  </div>
                  <span className={`text-sm font-semibold whitespace-nowrap ${a.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {formatCurrency(a.balance, a.currency)}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(a)} className="p-1.5 rounded hover:bg-[var(--color-surface2)] text-[var(--color-text-muted)]"><Pencil size={13} /></button>
                    <button onClick={() => setDeleting(a)} className="p-1.5 rounded hover:bg-red-500/15 text-[var(--color-text-muted)] hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-[var(--color-border)] flex justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">Total Cash</span>
                <span className={`font-bold ${nw.totalCash >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {formatCurrency(nw.totalCash, nw.baseCurrency)}
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* Investments (read-only) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Investments</CardTitle>
              <button
                onClick={() => navigate('/investments')}
                className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
              >
                View <ArrowRight size={12} />
              </button>
            </div>
          </CardHeader>

          {nw.portfolioInBase === 0 ? (
            <div className="py-6 text-center">
              <p className="text-3xl mb-2">📈</p>
              <p className="text-sm text-[var(--color-text-muted)]">No holdings tracked yet.</p>
              <button onClick={() => navigate('/investments')} className="mt-2 text-xs text-[var(--color-accent)] hover:underline">
                Go to Investments
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Portfolio Value</p>
                <p className="text-2xl font-bold text-[var(--color-text)] mt-0.5">
                  {formatCompact(nw.portfolioInBase, nw.baseCurrency)}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">{formatCurrency(nw.portfolioInBase, nw.baseCurrency)}</p>
              </div>
              <div className="flex items-center gap-2">
                {nw.portfolio.gainPercent >= 0
                  ? <TrendingUp size={16} className="text-emerald-500" />
                  : <TrendingDown size={16} className="text-red-500" />
                }
                <span className={`text-sm font-semibold ${nw.portfolio.gainPercent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {nw.portfolio.gainPercent >= 0 ? '+' : ''}{nw.portfolio.gainPercent.toFixed(2)}% all-time return
                </span>
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {nw.portfolio.gain >= 0 ? '+' : ''}{formatCurrency(nw.portfolio.gain, 'USD')} gain/loss (USD)
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Goals Allocation */}
      {(nw.goals.length > 0 || nw.totalCash > 0) && (
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Cash Allocation</CardTitle>
              <button
                onClick={() => navigate('/goals')}
                className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
              >
                Manage Goals <ArrowRight size={12} />
              </button>
            </div>
          </CardHeader>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Allocated to Goals</p>
              <p className="text-xl font-bold text-[var(--color-primary)] mt-0.5">
                {formatCurrency(nw.totalAllocatedToGoals, nw.baseCurrency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Free Cash</p>
              <p className={`text-xl font-bold mt-0.5 ${nw.freeCash >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {formatCurrency(nw.freeCash, nw.baseCurrency)}
              </p>
              {nw.freeCash < 0 && (
                <p className="text-xs text-red-400 mt-0.5">Goals exceed tracked cash</p>
              )}
            </div>
          </div>

          {/* Stacked bar */}
          {totalForBar > 0 && (
            <div className="mb-4">
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                <div
                  className="bg-[var(--color-accent)] transition-all rounded-l-full"
                  style={{ width: `${allocatedPct}%` }}
                />
                <div
                  className={`transition-all rounded-r-full ${nw.freeCash >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                  style={{ width: `${freePct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-[var(--color-text-muted)]">
                <span>Allocated {allocatedPct.toFixed(0)}%</span>
                <span>Free {freePct.toFixed(0)}%</span>
              </div>
            </div>
          )}

          {/* Goal list */}
          {nw.goals.length > 0 && (
            <div className="flex flex-col gap-2">
              {nw.goals.map(g => {
                const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0
                return (
                  <div key={g.id} className="flex items-center gap-3">
                    <span className="text-lg">{g.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-[var(--color-text)] truncate">{g.name}</span>
                        <span className="text-[var(--color-text-muted)] shrink-0 ml-2">
                          {formatCurrency(g.currentAmount, g.currency)} / {formatCurrency(g.targetAmount, g.currency)}
                        </span>
                      </div>
                      <ProgressBar value={pct} color={g.color} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {nw.goals.length === 0 && nw.totalCash > 0 && (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-2">
              No active goals. <button onClick={() => navigate('/goals')} className="text-[var(--color-accent)] hover:underline">Create one</button> to start allocating your cash.
            </p>
          )}
        </Card>
      )}

      {/* Liabilities */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Liabilities</CardTitle>
            {nw.mortgageSummary && (
              <button
                onClick={() => navigate('/mortgage')}
                className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
              >
                View Mortgage <ArrowRight size={12} />
              </button>
            )}
          </div>
        </CardHeader>

        {!nw.mortgageSummary ? (
          <p className="text-sm text-[var(--color-text-muted)] py-2">No liabilities tracked.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-[var(--color-text)]">{nw.mortgageSummary.mortgage.propertyName}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Mortgage</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-red-500">
                  {formatCurrency(nw.mortgageSummary.currentBalance, nw.mortgageSummary.mortgage.currency)}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">remaining</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
                <span>Payoff progress</span>
                <span>
                  {formatCurrency(nw.mortgageSummary.mortgage.originalAmount - nw.mortgageSummary.currentBalance, nw.mortgageSummary.mortgage.currency)} paid
                </span>
              </div>
              <ProgressBar
                value={nw.mortgageSummary.mortgage.originalAmount > 0
                  ? ((nw.mortgageSummary.mortgage.originalAmount - nw.mortgageSummary.currentBalance) / nw.mortgageSummary.mortgage.originalAmount) * 100
                  : 0}
                color="#6366f1"
              />
            </div>
          </div>
        )}
      </Card>

      {/* Add/Edit Account Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Account' : 'Add Account'} size="sm">
        <div className="flex flex-col gap-3">
          {/* Icon picker */}
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Icon — selected: <span className="text-base">{form.icon}</span></label>
            <div className="flex gap-2 mt-1">
              {ACCOUNT_ICONS.map(icon => (
                <button key={icon} onClick={() => setF('icon', icon)}
                  className={`text-xl p-1 rounded transition-all ${form.icon === icon ? 'ring-2 ring-[var(--color-accent)] bg-[var(--color-surface2)] scale-110' : 'hover:bg-[var(--color-surface2)]'}`}
                >{icon}</button>
              ))}
            </div>
          </div>

          <Input label="Account Name" placeholder="Bank Leumi Checking" value={form.name} onChange={e => setF('name', e.target.value)} />

          <Select label="Type" value={form.type} onChange={e => setF('type', e.target.value)}>
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="credit">Credit Card</option>
            <option value="cash">Cash</option>
          </Select>

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Current Balance"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.balance}
              onChange={e => setF('balance', e.target.value)}
            />
            <Select label="Currency" value={form.currency} onChange={e => setF('currency', e.target.value)}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}
            </Select>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] -mt-1">Use a negative balance for credit card debt (e.g. -2500)</p>

          <Input label="Notes (optional)" placeholder="Main account" value={form.notes} onChange={e => setF('notes', e.target.value)} />

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={!form.name.trim() || form.balance === '' || saving}>
              {editing ? 'Save' : 'Add Account'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(undefined)}
        onConfirm={handleDelete}
        title="Delete Account"
        message={`Delete "${deleting?.name}"? This won't affect your transactions.`}
      />
    </div>
  )
}
