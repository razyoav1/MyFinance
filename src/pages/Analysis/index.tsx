import { useState } from 'react'
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react'
import { useCurrencyStore } from '@/store/useCurrencyStore'
import { useAnalysis } from '@/hooks/useAnalysis'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency, formatCompact } from '@/lib/currency'
import { TIERS } from '@/lib/tiers'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const now = new Date()

const tooltipStyle = {
  contentStyle: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 },
  labelStyle: { color: 'var(--color-text)' },
  itemStyle: { color: 'var(--color-text)' },
}

export function Analysis() {
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear]  = useState(now.getFullYear())
  const { baseCurrency, exchangeRates } = useCurrencyStore()
  const data = useAnalysis(year, month, baseCurrency, exchangeRates)

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()
  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const fmt = (n: number) => formatCurrency(n, baseCurrency)

  const lifestyleShare = data?.expenseTiers.find(t => t.key === 'lifestyle')?.pct ?? 0

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <h1 className="text-xl font-bold text-[var(--color-text)]">Analysis</h1>
        <div className="flex items-center gap-1 ml-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-1 py-0.5">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-[var(--color-surface2)] text-[var(--color-text-muted)] transition-colors">
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-semibold text-[var(--color-text)] min-w-[90px] text-center select-none">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={nextMonth} disabled={isCurrentMonth}
            className="p-1 rounded hover:bg-[var(--color-surface2)] text-[var(--color-text-muted)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight size={15} />
          </button>
        </div>
        {!isCurrentMonth && (
          <button onClick={() => { setMonth(now.getMonth() + 1); setYear(now.getFullYear()) }}
            className="text-xs text-[var(--color-accent)] hover:underline">Today</button>
        )}
      </div>

      {!data ? (
        <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">Loading…</p>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Income',        value: formatCompact(data.income, baseCurrency),   color: 'text-emerald-500' },
              { label: 'Expenses',      value: formatCompact(data.expenses, baseCurrency), color: 'text-red-500' },
              { label: 'Savings Rate',  value: `${data.savingsRate.toFixed(0)}%`,          color: data.savingsRate >= 20 ? 'text-emerald-500' : 'text-amber-500' },
              { label: 'Building Wealth', value: data.income > 0 ? `${data.wealthPct.toFixed(0)}%` : '—', color: 'text-indigo-400', sub: 'of income → debt, investing & savings' },
            ].map(({ label, value, color, sub }) => (
              <Card key={label}>
                <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
                {sub && <p className="text-[10px] text-[var(--color-text-muted)] mt-1 leading-tight">{sub}</p>}
              </Card>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Expense quality tiers */}
            <Card>
              <CardHeader><CardTitle>Expense Quality</CardTitle></CardHeader>
              {data.expenses === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No expenses this month</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                      <Pie data={data.expenseTiers.filter(t => t.value > 0)} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={52} outerRadius={82}>
                        {data.expenseTiers.filter(t => t.value > 0).map(t => <Cell key={t.key} fill={t.color} />)}
                      </Pie>
                      <Tooltip {...tooltipStyle} formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2 mt-2">
                    {data.expenseTiers.map(t => (
                      <div key={t.key}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5 text-[var(--color-text)]">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
                            {t.icon} {t.label}
                          </span>
                          <span className="text-[var(--color-text-muted)]">{fmt(t.value)} · {t.pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--color-surface2)] mt-1 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${t.pct}%`, background: t.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-3">
                    {lifestyleShare > 35
                      ? `Lifestyle is ${lifestyleShare.toFixed(0)}% of spending — above the ~30% rule of thumb.`
                      : `Lifestyle is ${lifestyleShare.toFixed(0)}% of spending — within a healthy range.`}
                  </p>
                </>
              )}
            </Card>

            {/* Biggest changes vs last month */}
            <Card>
              <CardHeader><CardTitle>Biggest Changes vs {data.prevMonthLabel}</CardTitle></CardHeader>
              {data.movers.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No changes to show</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                  {data.movers.slice(0, 8).map(m => {
                    const up = m.delta > 0
                    return (
                      <div key={m.id} className="flex items-center justify-between py-1 border-b border-[var(--color-border)] last:border-0">
                        <span className="flex items-center gap-2 text-sm text-[var(--color-text)] min-w-0">
                          <span className="text-lg shrink-0">{m.icon}</span>
                          <span className="truncate">{m.name}</span>
                        </span>
                        <span className={`flex items-center gap-1 text-sm font-semibold shrink-0 ml-2 ${up ? 'text-red-500' : 'text-emerald-500'}`}>
                          {up ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                          {fmt(Math.abs(m.delta))}
                          <span className="text-xs font-normal text-[var(--color-text-muted)]">
                            {m.pct === null ? '(new)' : `(${up ? '+' : ''}${m.pct.toFixed(0)}%)`}
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* 6-month tier trend */}
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Spending Tiers — Last 6 Months</CardTitle></CardHeader>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickFormatter={(v: number) => formatCompact(v, baseCurrency)} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {TIERS.map(t => (
                    <Bar key={t.key} dataKey={t.label} stackId="a" fill={t.color} radius={t.key === 'lifestyle' ? [4, 4, 0, 0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Where money goes */}
            <Card>
              <CardHeader><CardTitle>Where Your Money Goes</CardTitle></CardHeader>
              {data.expenseByCategory.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No expenses this month</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.expenseByCategory.slice(0, 8).map(c => (
                    <div key={c.id}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-[var(--color-text)] min-w-0">
                          <span className="shrink-0">{c.icon}</span><span className="truncate">{c.name}</span>
                        </span>
                        <span className="text-[var(--color-text-muted)] shrink-0 ml-2">{fmt(c.value)} · {c.pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--color-surface2)] mt-1 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Income sources */}
            <Card>
              <CardHeader><CardTitle>Income Sources</CardTitle></CardHeader>
              {data.incomeByCategory.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No income this month</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={data.incomeByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                        {data.incomeByCategory.map(c => <Cell key={c.id} fill={c.color} />)}
                      </Pie>
                      <Tooltip {...tooltipStyle} formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-1 mt-1">
                    {data.incomeByCategory.slice(0, 5).map(c => (
                      <div key={c.id} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-[var(--color-text)] min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                          <span className="truncate">{c.icon} {c.name}</span>
                        </span>
                        <span className="text-[var(--color-text-muted)] shrink-0 ml-2">{fmt(c.value)} · {c.pct.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>

            {/* Biggest expenses */}
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Biggest Expenses This Month</CardTitle></CardHeader>
              {data.topExpenses.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No expenses this month</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.topExpenses.map(t => (
                    <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)] last:border-0">
                      <span className="flex items-center gap-3 min-w-0">
                        <span className="text-xl shrink-0">{t.icon}</span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-[var(--color-text)] truncate">{t.description}</span>
                          <span className="block text-xs text-[var(--color-text-muted)]">{t.date}</span>
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-red-500 shrink-0 ml-2">{fmt(t.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
