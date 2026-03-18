import { Moon, Sun } from 'lucide-react'
import { db } from '@/db'
import { useThemeStore } from '@/store/useThemeStore'
import { useCurrencyStore } from '@/store/useCurrencyStore'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { CURRENCIES } from '@/types'
import { useState } from 'react'

const RATE_PAIRS = [
  { from: 'USD', to: 'ILS' },
  { from: 'EUR', to: 'ILS' },
  { from: 'GBP', to: 'ILS' },
  { from: 'USD', to: 'EUR' },
]

export function SettingsPage() {
  const { theme, setTheme } = useThemeStore()
  const { baseCurrency, setBaseCurrency, exchangeRates, setRate } = useCurrencyStore()
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({})

  const handleRateSave = (from: string, to: string) => {
    const key = `${from}_${to}`
    const val = parseFloat(rateInputs[key] ?? String(exchangeRates[key] ?? ''))
    if (!isNaN(val)) setRate(from, to, val)
    setRateInputs(r => ({ ...r, [key]: '' }))
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
            <Select
              label="Base Currency"
              value={baseCurrency}
              onChange={e => setBaseCurrency(e.target.value)}
            >
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
          <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-text-muted)]">Current rates:</p>
            {Object.entries(exchangeRates).map(([k, v]) => (
              <span key={k} className="text-xs text-[var(--color-text-muted)] mr-3">
                {k.replace('_', '→')}: {v}
              </span>
            ))}
          </div>
        </Card>

        {/* Data */}
        <Card>
          <CardHeader><CardTitle>Data</CardTitle></CardHeader>
          <p className="text-xs text-[var(--color-text-muted)] mb-3">
            Your data is stored locally in your browser's IndexedDB. It never leaves your device.
          </p>
          <Button variant="outline" size="sm" onClick={async () => {
            const data = {
              categories: await db.categories.toArray(),
              transactions: await db.transactions.toArray(),
              investments: await db.investmentHoldings.toArray(),
              mortgages: await db.mortgages.toArray(),
              goals: await db.savingsGoals.toArray(),
            }
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `myfinance-backup-${new Date().toISOString().split('T')[0]}.json`
            a.click()
          }}>
            Export Data (JSON)
          </Button>
        </Card>
      </div>
    </div>
  )
}
