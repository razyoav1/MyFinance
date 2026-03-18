import { useState } from 'react'
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { useInvestments, usePortfolioTotal, usePortfolioHistory, addInvestment, updateInvestment, deleteInvestment, updatePrice } from '@/hooks/useInvestments'
import { InvestmentHolding, CURRENCIES } from '@/types'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/currency'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { format } from 'date-fns'

const ASSET_TYPES = ['stock', 'etf', 'crypto', 'other'] as const

const defaultForm = {
  symbol: '', name: '', assetType: 'stock' as InvestmentHolding['assetType'],
  quantity: '', purchasePrice: '', purchaseCurrency: 'USD',
  purchaseDate: format(new Date(), 'yyyy-MM-dd'),
  currentPrice: '', currentCurrency: 'USD', notes: '',
}

export function Investments() {
  const holdings = useInvestments()
  const portfolio = usePortfolioTotal()
  const history = usePortfolioHistory() as { date: string; value: number }[]
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<InvestmentHolding | undefined>()
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [editingPrice, setEditingPrice] = useState<number | null>(null)
  const [priceInput, setPriceInput] = useState('')

  const setF = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const openAdd = () => { setEditing(undefined); setForm(defaultForm); setFormOpen(true) }
  const openEdit = (h: InvestmentHolding) => {
    setEditing(h)
    setForm({
      symbol: h.symbol, name: h.name, assetType: h.assetType,
      quantity: String(h.quantity), purchasePrice: String(h.purchasePrice),
      purchaseCurrency: h.purchaseCurrency, purchaseDate: h.purchaseDate,
      currentPrice: String(h.currentPrice), currentCurrency: h.currentCurrency, notes: h.notes ?? '',
    })
    setFormOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const data: Omit<InvestmentHolding, 'id'> = {
      symbol: form.symbol.toUpperCase(),
      name: form.name,
      assetType: form.assetType,
      quantity: parseFloat(form.quantity),
      purchasePrice: parseFloat(form.purchasePrice),
      purchaseCurrency: form.purchaseCurrency,
      purchaseDate: form.purchaseDate,
      currentPrice: parseFloat(form.currentPrice || form.purchasePrice),
      currentCurrency: form.currentCurrency,
      notes: form.notes || undefined,
      updatedAt: new Date().toISOString(),
    }
    if (editing?.id) await updateInvestment(editing.id, data)
    else await addInvestment(data)
    setSaving(false)
    setFormOpen(false)
  }

  const handlePriceUpdate = async (id: number, currency: string) => {
    const price = parseFloat(priceInput)
    if (isNaN(price)) return
    await updatePrice(id, price, currency)
    setEditingPrice(null)
    setPriceInput('')
  }

  const assetBadgeColor: Record<string, string> = {
    stock: '#6366f1', etf: '#3b82f6', crypto: '#f59e0b', other: '#94a3b8',
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[var(--color-text)]">Investments</h1>
        <Button onClick={openAdd} size="sm"><Plus size={14} /> Add Holding</Button>
      </div>

      {/* Portfolio summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Total Invested', value: formatCurrency(portfolio.totalInvested, 'USD') },
          { label: 'Current Value', value: formatCurrency(portfolio.totalCurrent, 'USD') },
          { label: 'Total Gain/Loss', value: formatCurrency(portfolio.gain, 'USD'), color: portfolio.gain >= 0 ? 'text-emerald-500' : 'text-red-500' },
          { label: 'Return', value: `${portfolio.gainPercent >= 0 ? '+' : ''}${portfolio.gainPercent.toFixed(2)}%`, color: portfolio.gainPercent >= 0 ? 'text-emerald-500' : 'text-red-500' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
            <p className={`font-bold text-lg mt-1 ${color ?? 'text-[var(--color-text)]'}`}>{value}</p>
          </Card>
        ))}
      </div>

      {/* Portfolio history chart */}
      {history.length > 1 && (
        <Card className="mb-4">
          <CardHeader><CardTitle>Portfolio Value Over Time</CardTitle></CardHeader>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}
                formatter={(val: number) => formatCurrency(val, 'USD')}
              />
              <Line type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Holdings list */}
      {holdings.length === 0 ? (
        <EmptyState
          icon="📈"
          title="No holdings yet"
          description="Add your stocks, ETFs, or crypto to track your portfolio."
          action={<Button onClick={openAdd} size="sm"><Plus size={14} /> Add Holding</Button>}
        />
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface2)]">
                  {['Asset', 'Type', 'Quantity', 'Cost Basis', 'Current Value', 'Gain/Loss', 'Current Price', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.map((h, i) => (
                  <tr key={h.id} className={`border-b border-[var(--color-border)] hover:bg-[var(--color-surface2)] transition-colors ${i === holdings.length - 1 ? 'border-0' : ''}`}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-[var(--color-text)]">{h.symbol}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{h.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={assetBadgeColor[h.assetType]}>{h.assetType.toUpperCase()}</Badge>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text)]">{h.quantity}</td>
                    <td className="px-4 py-3 text-[var(--color-text)]">{formatCurrency(h.costBasis, h.purchaseCurrency)}</td>
                    <td className="px-4 py-3 font-medium text-[var(--color-text)]">{formatCurrency(h.currentValue, h.currentCurrency)}</td>
                    <td className={`px-4 py-3 font-semibold ${h.gainAbsolute >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      <div className="flex items-center gap-1">
                        {h.gainAbsolute >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {h.gainPercent >= 0 ? '+' : ''}{h.gainPercent.toFixed(2)}%
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {editingPrice === h.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            value={priceInput}
                            onChange={e => setPriceInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handlePriceUpdate(h.id!, h.currentCurrency) }}
                            autoFocus
                            className="w-20 h-7 px-2 text-xs rounded border border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none"
                          />
                          <button onClick={() => handlePriceUpdate(h.id!, h.currentCurrency)} className="text-emerald-500 hover:text-emerald-400"><RefreshCw size={12} /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingPrice(h.id!); setPriceInput(String(h.currentPrice)) }}
                          className="text-sm text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors underline-offset-2 hover:underline"
                        >
                          {formatCurrency(h.currentPrice, h.currentCurrency)}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(h)} className="p-1.5 rounded hover:bg-[var(--color-surface2)] text-[var(--color-text-muted)]"><Pencil size={13} /></button>
                        <button onClick={() => h.id && deleteInvestment(h.id)} className="p-1.5 rounded hover:bg-red-500/15 text-[var(--color-text-muted)] hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Holding' : 'Add Holding'}>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input label="Symbol" placeholder="AAPL" value={form.symbol} onChange={e => setF('symbol', e.target.value)} className="w-24" />
            <Input label="Name" placeholder="Apple Inc." value={form.name} onChange={e => setF('name', e.target.value)} className="flex-1" />
          </div>
          <Select label="Asset Type" value={form.assetType} onChange={e => setF('assetType', e.target.value)}>
            {ASSET_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
          </Select>
          <div className="flex gap-2">
            <Input label="Quantity" type="number" step="0.0001" value={form.quantity} onChange={e => setF('quantity', e.target.value)} className="flex-1" />
            <Input label="Purchase Date" type="date" value={form.purchaseDate} onChange={e => setF('purchaseDate', e.target.value)} className="flex-1" />
          </div>
          <div className="flex gap-2">
            <Input label="Purchase Price" type="number" step="0.01" value={form.purchasePrice} onChange={e => setF('purchasePrice', e.target.value)} className="flex-1" />
            <Select label="Currency" value={form.purchaseCurrency} onChange={e => setF('purchaseCurrency', e.target.value)} className="w-24">
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
            </Select>
          </div>
          <div className="flex gap-2">
            <Input label="Current Price" type="number" step="0.01" value={form.currentPrice} onChange={e => setF('currentPrice', e.target.value)} className="flex-1" />
            <Select label="Currency" value={form.currentCurrency} onChange={e => setF('currentCurrency', e.target.value)} className="w-24">
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
            </Select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !form.symbol || !form.name || !form.quantity || !form.purchasePrice}>
              {saving ? 'Saving...' : editing ? 'Save' : 'Add Holding'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
