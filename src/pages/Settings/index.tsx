import { useState, useEffect } from 'react'
import { Moon, Sun, Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useThemeStore } from '@/store/useThemeStore'
import { useCurrencyStore } from '@/store/useCurrencyStore'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Badge } from '@/components/ui/Badge'
import { CURRENCIES, Category } from '@/types'
import { toast } from '@/store/useToastStore'
import { useRefresh } from '@/contexts/RefreshContext'

const RATE_PAIRS = [
  { from: 'USD', to: 'ILS' },
  { from: 'EUR', to: 'ILS' },
  { from: 'GBP', to: 'ILS' },
  { from: 'USD', to: 'EUR' },
]

const EMOJI_GROUPS: { label: string; icons: string[] }[] = [
  { label: 'Shopping',     icons: ['🛒','🛍️','👗','👠','👜','💍','💄','🧴','👟','🧢','🕶️','⌚'] },
  { label: 'Food & Drink', icons: ['🍔','🍕','🍜','🥗','☕','🍺','🍣','🥩','🧁','🍱','🥐','🍷'] },
  { label: 'Pets',         icons: ['🐶','🐱','🐾','🦴','🐕','🐈','🐟','🐠','🐹','🐰','🦜','🐢'] },
  { label: 'Transport',    icons: ['🚗','🚌','✈️','🚂','🛵','🚲','⛽','🚕','🛳️','🚁','🏍️','🚐'] },
  { label: 'Home',         icons: ['🏠','🔑','🛋️','🧹','💡','🔧','🛁','🏡','🪴','🛏️','🪟','🏗️'] },
  { label: 'Health',       icons: ['💊','🏥','🦷','👓','🧬','💉','🧘','🏋️','🩺','🩹','💪','🫀'] },
  { label: 'Entertainment',icons: ['🎬','🎮','🎵','📚','🎭','🎨','🎲','🎸','🎤','🎧','🎪','🎯'] },
  { label: 'Education',    icons: ['🎓','📖','✏️','🔬','🏫','📝','🖊️','🧮','📐','🔭','📓','🧑‍💻'] },
  { label: 'Finance',      icons: ['💰','💵','🏦','💳','📈','💸','🪙','🤑','📉','💹','🧾','🏧'] },
  { label: 'Work',         icons: ['💼','👔','💻','🖥️','📊','📱','📞','🖨️','🗂️','📋','🖇️','📌'] },
  { label: 'Travel',       icons: ['🌍','🗺️','🏖️','🏔️','🧳','🗼','🏰','🚢','🏕️','🌋','🗽','🎑'] },
  { label: 'Kids & Family',icons: ['🧸','👶','🎠','🎡','🪀','🎈','🎒','🧩','🪁','🎀','🪅','🧃'] },
  { label: 'Nature',       icons: ['🌱','🌸','🌻','🍀','🌊','⛅','🌙','⭐','🔥','❄️','🌈','🌿'] },
  { label: 'Misc',         icons: ['🎁','⚡','🔮','🎯','💫','🏆','🎗️','🔐','📦','🗝️','🪣','🧲'] },
]
const ALL_ICONS = EMOJI_GROUPS.flatMap(g => g.icons)

const CATEGORY_COLORS = [
  '#6366f1','#8b5cf6','#a855f7','#ec4899','#f43f5e',
  '#ef4444','#f97316','#f59e0b','#eab308','#84cc16',
  '#10b981','#14b8a6','#06b6d4','#3b82f6','#0ea5e9',
  '#64748b','#78716c','#1e293b',
]

const defaultCatForm = { name: '', icon: '🛒', color: '#6366f1', type: 'expense' as Category['type'] }

function mapCategory(row: Record<string, any>): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    type: row.type,
    isSystem: row.is_system ?? false,
  }
}

export function SettingsPage() {
  const { theme, setTheme } = useThemeStore()
  const { baseCurrency, setBaseCurrency, exchangeRates, setRate } = useCurrencyStore()
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({})
  const { refresh } = useRefresh()

  const [categories, setCategories] = useState<Category[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!userId) return
    supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true })
      .then(({ data }) => setCategories((data ?? []).map(mapCategory)))
  }, [userId, refresh])

  const [catFormOpen, setCatFormOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<Category | undefined>()
  const [catForm, setCatForm] = useState(defaultCatForm)
  const [deletingCat, setDeletingCat] = useState<Category | undefined>()
  const [emojiSearch, setEmojiSearch] = useState('')
  const [emojiGroup, setEmojiGroup] = useState('All')

  const handleRateSave = (from: string, to: string) => {
    const key = `${from}_${to}`
    const val = parseFloat(rateInputs[key] ?? String(exchangeRates[key] ?? ''))
    if (!isNaN(val)) setRate(from, to, val)
    setRateInputs(r => ({ ...r, [key]: '' }))
  }

  const openAddCat = () => { setEditingCat(undefined); setCatForm(defaultCatForm); setEmojiSearch(''); setEmojiGroup('All'); setCatFormOpen(true) }
  const openEditCat = (c: Category) => { setEditingCat(c); setCatForm({ name: c.name, icon: c.icon, color: c.color, type: c.type }); setEmojiSearch(''); setEmojiGroup('All'); setCatFormOpen(true) }

  const handleSaveCat = async () => {
    if (!catForm.name.trim() || !userId) return
    if (editingCat?.id) {
      await supabase.from('categories').update({
        name: catForm.name,
        icon: catForm.icon,
        color: catForm.color,
        type: catForm.type,
      }).eq('id', editingCat.id)
      toast.success('Category updated')
    } else {
      await supabase.from('categories').insert({
        user_id: userId,
        name: catForm.name,
        icon: catForm.icon,
        color: catForm.color,
        type: catForm.type,
        is_system: false,
      })
      toast.success('Category added')
    }
    setCatFormOpen(false)
    // Refetch categories
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true })
    setCategories((data ?? []).map(mapCategory))
    refresh()
  }

  const handleDeleteCat = async () => {
    if (!deletingCat?.id) return
    await supabase.from('categories').delete().eq('id', deletingCat.id)
    toast.success('Category deleted')
    setDeletingCat(undefined)
    if (userId) {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true })
      setCategories((data ?? []).map(mapCategory))
      refresh()
    }
  }

  const handleExport = async () => {
    if (!userId) return
    const [
      { data: cats },
      { data: txns },
      { data: investments },
      { data: mortgages },
      { data: goals },
      { data: contributions },
      { data: mortgagePayments },
      { data: bankAccounts },
    ] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', userId),
      supabase.from('transactions').select('*').eq('user_id', userId),
      supabase.from('investment_holdings').select('*').eq('user_id', userId),
      supabase.from('mortgages').select('*').eq('user_id', userId),
      supabase.from('savings_goals').select('*').eq('user_id', userId),
      supabase.from('goal_contributions').select('*').eq('user_id', userId),
      supabase.from('mortgage_payments').select('*').eq('user_id', userId),
      supabase.from('bank_accounts').select('*').eq('user_id', userId),
    ])

    const exportData = {
      categories: cats ?? [],
      transactions: txns ?? [],
      investments: investments ?? [],
      mortgages: mortgages ?? [],
      goals: goals ?? [],
      goalContributions: contributions ?? [],
      mortgagePayments: mortgagePayments ?? [],
      bankAccounts: bankAccounts ?? [],
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `myfinance-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Data exported')
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)

        if (data.transactions?.length) {
          const rows = data.transactions.map((t: any) => ({ ...t, id: undefined, user_id: userId }))
          await supabase.from('transactions').upsert(rows, { onConflict: 'id' })
        }
        if (data.categories?.length) {
          const rows = data.categories.map((c: any) => ({ ...c, id: undefined, user_id: userId }))
          await supabase.from('categories').upsert(rows, { onConflict: 'id' })
        }
        if (data.investments?.length) {
          const rows = data.investments.map((i: any) => ({ ...i, id: undefined, user_id: userId }))
          await supabase.from('investment_holdings').upsert(rows, { onConflict: 'id' })
        }
        if (data.mortgages?.length) {
          const rows = data.mortgages.map((m: any) => ({ ...m, id: undefined, user_id: userId }))
          await supabase.from('mortgages').upsert(rows, { onConflict: 'id' })
        }
        if (data.goals?.length) {
          const rows = data.goals.map((g: any) => ({ ...g, id: undefined, user_id: userId }))
          await supabase.from('savings_goals').upsert(rows, { onConflict: 'id' })
        }
        if (data.goalContributions?.length) {
          const rows = data.goalContributions.map((c: any) => ({ ...c, id: undefined, user_id: userId }))
          await supabase.from('goal_contributions').upsert(rows, { onConflict: 'id' })
        }
        if (data.mortgagePayments?.length) {
          const rows = data.mortgagePayments.map((p: any) => ({ ...p, id: undefined, user_id: userId }))
          await supabase.from('mortgage_payments').upsert(rows, { onConflict: 'id' })
        }
        if (data.bankAccounts?.length) {
          const rows = data.bankAccounts.map((a: any) => ({ ...a, id: undefined, user_id: userId }))
          await supabase.from('bank_accounts').upsert(rows, { onConflict: 'id' })
        }

        toast.success('Data imported successfully')
        refresh()
      } catch {
        toast.error('Failed to import — invalid file format')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-[var(--color-text)] mb-4">Settings</h1>

      <div className="flex flex-col gap-4">
        {/* Appearance */}
        <Card>
          <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
          <div className="flex gap-2">
            {(['light', 'dark'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  theme === t
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)]'
                }`}
              >
                {t === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </Card>

        {/* Currency */}
        <Card>
          <CardHeader><CardTitle>Currency</CardTitle></CardHeader>
          <div className="flex flex-col gap-3">
            <Select label="Base Currency" value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)}>
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.symbol} {c.name} ({c.code})</option>
              ))}
            </Select>
          </div>
        </Card>

        {/* Exchange rates */}
        <Card>
          <CardHeader><CardTitle>Exchange Rates (manual)</CardTitle></CardHeader>
          <p className="text-xs text-[var(--color-text-muted)] mb-3">
            Enter current exchange rates. Used to convert amounts to your base currency on the dashboard.
          </p>
          <div className="flex flex-col gap-2">
            {RATE_PAIRS.map(({ from, to }) => {
              const key = `${from}_${to}`
              const current = exchangeRates[key]
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--color-text)] w-20">1 {from} =</span>
                  <Input
                    type="number"
                    step="0.001"
                    placeholder={String(current ?? '')}
                    value={rateInputs[key] ?? ''}
                    onChange={e => setRateInputs(r => ({ ...r, [key]: e.target.value }))}
                    className="flex-1"
                  />
                  <span className="text-sm text-[var(--color-text-muted)] w-10">{to}</span>
                  <Button size="sm" variant="outline" onClick={() => handleRateSave(from, to)}>Save</Button>
                </div>
              )
            })}
          </div>
          {Object.keys(exchangeRates).length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">Current rates:</p>
              {Object.entries(exchangeRates).map(([k, v]) => (
                <span key={k} className="text-xs text-[var(--color-text-muted)] mr-3">
                  {k.replace('_', '→')}: {v}
                </span>
              ))}
            </div>
          )}
        </Card>

        {/* Categories */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Categories</CardTitle>
              <Button size="sm" onClick={openAddCat}><Plus size={13} /> Add</Button>
            </div>
          </CardHeader>
          <div className="flex flex-col gap-1">
            {categories.map(c => (
              <div key={c.id} className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-[var(--color-surface2)] group">
                <Badge color={c.color}>{c.icon} {c.name}</Badge>
                <span className="text-xs text-[var(--color-text-muted)] capitalize">{c.type}</span>
                {c.isSystem && <span className="text-xs text-[var(--color-text-muted)] ml-auto opacity-50">system</span>}
                <div className={`flex gap-1 ${c.isSystem ? 'opacity-0 pointer-events-none' : 'ml-auto'} group-hover:opacity-100 transition-opacity`}>
                  <button onClick={() => openEditCat(c)} className="p-1 rounded hover:bg-[var(--color-surface2)] text-[var(--color-text-muted)]"><Pencil size={12} /></button>
                  <button onClick={() => setDeletingCat(c)} className="p-1 rounded hover:bg-red-500/15 text-[var(--color-text-muted)] hover:text-red-500"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Data */}
        <Card>
          <CardHeader><CardTitle>Data</CardTitle></CardHeader>
          <p className="text-xs text-[var(--color-text-muted)] mb-3">
            Your data is synced to the cloud via Supabase and accessible from any device.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExport}>
              Export Data (JSON)
            </Button>
            <label className="cursor-pointer">
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] transition-colors">
                Import / Restore
              </span>
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </Card>
      </div>

      {/* Category form modal */}
      <Modal open={catFormOpen} onClose={() => setCatFormOpen(false)} title={editingCat ? 'Edit Category' : 'Add Category'} size="md">
        <div className="flex flex-col gap-3">
          <Input label="Name" placeholder="Groceries" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} />

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">Icon — selected: <span className="text-base">{catForm.icon}</span></label>
            </div>
            {/* Search */}
            <Input
              placeholder="Search emojis..."
              value={emojiSearch}
              onChange={e => { setEmojiSearch(e.target.value); setEmojiGroup('All') }}
              className="mb-2"
            />
            {/* Group tabs */}
            {!emojiSearch && (
              <div className="flex gap-1 flex-wrap mb-2">
                {['All', ...EMOJI_GROUPS.map(g => g.label)].map(g => (
                  <button
                    key={g}
                    onClick={() => setEmojiGroup(g)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      emojiGroup === g
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'bg-[var(--color-surface2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                    }`}
                  >{g}</button>
                ))}
              </div>
            )}
            {/* Emoji grid */}
            <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto p-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)]">
              {(emojiSearch
                ? ALL_ICONS.filter(i => i.includes(emojiSearch))
                : emojiGroup === 'All'
                  ? ALL_ICONS
                  : EMOJI_GROUPS.find(g => g.label === emojiGroup)?.icons ?? []
              ).map(icon => (
                <button key={icon} onClick={() => setCatForm(f => ({ ...f, icon }))}
                  className={`text-xl p-1 rounded transition-all ${catForm.icon === icon ? 'ring-2 ring-[var(--color-accent)] bg-[var(--color-surface)] scale-110' : 'hover:bg-[var(--color-surface)]'}`}
                >{icon}</button>
              ))}
            </div>
          </div>

          <Select label="Type" value={catForm.type} onChange={e => setCatForm(f => ({ ...f, type: e.target.value as Category['type'] }))}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="both">Both</option>
          </Select>

          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Color</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {CATEGORY_COLORS.map(color => (
                <button key={color} onClick={() => setCatForm(f => ({ ...f, color }))}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${catForm.color === color ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCatFormOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleSaveCat} disabled={!catForm.name.trim()}>
              {editingCat ? 'Save' : 'Add Category'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deletingCat}
        onClose={() => setDeletingCat(undefined)}
        onConfirm={handleDeleteCat}
        title="Delete Category"
        message={`Delete the "${deletingCat?.name}" category? Existing transactions with this category won't be deleted.`}
      />
    </div>
  )
}
