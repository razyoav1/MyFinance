import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCurrencyStore } from '@/store/useCurrencyStore'
import { useBudgetPlan, setBudget, type BudgetRow } from '@/hooks/useBudgets'
import { Card } from '@/components/ui/Card'
import { formatCurrency, formatCompact } from '@/lib/currency'
import { tierMeta } from '@/lib/tiers'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const now = new Date()

export function Budget() {
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear]  = useState(now.getFullYear())
  const { baseCurrency, exchangeRates } = useCurrencyStore()
  const plan = useBudgetPlan(year, month, baseCurrency, exchangeRates)

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()
  const atYearEnd = year === now.getFullYear() && month === 12
  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const fmt = (n: number) => formatCurrency(n, baseCurrency)
  const remaining = plan ? plan.totalBudget - plan.totalSpent : 0
  const toAllocate = plan ? plan.income - plan.totalBudget : 0

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <h1 className="text-xl font-bold text-[var(--color-text)]">Budget</h1>
        <div className="flex items-center gap-1 ml-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-1 py-0.5">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-[var(--color-surface2)] text-[var(--color-text-muted)] transition-colors">
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-semibold text-[var(--color-text)] min-w-[90px] text-center select-none">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={nextMonth} disabled={atYearEnd}
            className="p-1 rounded hover:bg-[var(--color-surface2)] text-[var(--color-text-muted)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight size={15} />
          </button>
        </div>
        {!isCurrentMonth && (
          <button onClick={() => { setMonth(now.getMonth() + 1); setYear(now.getFullYear()) }}
            className="text-xs text-[var(--color-accent)] hover:underline">Today</button>
        )}
      </div>

      {!plan ? (
        <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">Loading…</p>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {[
              { label: 'Budgeted', value: formatCompact(plan.totalBudget, baseCurrency), color: 'text-[var(--color-text)]' },
              { label: 'Spent',    value: formatCompact(plan.totalSpent, baseCurrency),  color: 'text-red-500' },
              { label: 'Remaining', value: formatCompact(remaining, baseCurrency),        color: remaining >= 0 ? 'text-emerald-500' : 'text-red-500' },
              { label: 'Income',   value: formatCompact(plan.income, baseCurrency),       color: 'text-emerald-500' },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
              </Card>
            ))}
          </div>

          {/* Allocation hint */}
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            Set a monthly limit next to any category — budgets repeat every month.{' '}
            {plan.income > 0 && plan.totalBudget > 0 && (
              toAllocate >= 0
                ? `You've budgeted ${fmt(plan.totalBudget)} of your ${fmt(plan.income)} income — ${fmt(toAllocate)} left to allocate.`
                : `You've budgeted ${fmt(plan.totalBudget)}, which is ${fmt(-toAllocate)} more than your ${fmt(plan.income)} income.`
            )}
          </p>

          {/* Tier sections */}
          <div className="flex flex-col gap-4">
            {plan.byTier.map(group => (
              <Card key={group.key}>
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 font-semibold text-[var(--color-text)]">
                    <span style={{ color: group.meta.color }}>{group.meta.icon} {group.meta.label}</span>
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {fmt(group.spent)}{group.budget > 0 ? ` of ${fmt(group.budget)}` : ''}
                  </span>
                </div>
                <div className="flex flex-col">
                  {group.rows.map(row => (
                    <BudgetRowItem key={row.categoryId} row={row} baseCurrency={baseCurrency} />
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function BudgetRowItem({ row, baseCurrency }: { row: BudgetRow; baseCurrency: string }) {
  const [val, setVal] = useState(row.budget ? String(row.budget) : '')
  const fmt = (n: number) => formatCurrency(n, baseCurrency)
  const over = row.hasBudget && row.spent > row.budget
  const barPct = Math.min(100, row.pct)

  const save = () => {
    const n = parseFloat(val)
    setBudget(row.categoryId, isNaN(n) ? 0 : n)
  }

  return (
    <div className="py-2 border-b border-[var(--color-border)] last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 min-w-0 text-sm text-[var(--color-text)]">
          <span className="text-lg shrink-0">{row.icon}</span>
          <span className="truncate">{row.name}</span>
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm text-[var(--color-text-muted)]">{fmt(row.spent)}</span>
          <span className="text-[var(--color-text-muted)] text-xs">/</span>
          <input
            type="number"
            min="0"
            placeholder="—"
            value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={save}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            className="w-24 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm text-right text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>
      </div>
      {row.hasBudget && (
        <div className="mt-1.5">
          <div className="h-1.5 rounded-full bg-[var(--color-surface2)] overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, background: over ? '#ef4444' : tierMeta(row.tier).color }} />
          </div>
          <div className="flex justify-between text-xs mt-0.5">
            <span className="text-[var(--color-text-muted)]">{row.pct.toFixed(0)}% used</span>
            <span className={over ? 'text-red-500 font-medium' : 'text-[var(--color-text-muted)]'}>
              {over ? `over by ${fmt(row.spent - row.budget)}` : `${fmt(row.remaining)} left`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
