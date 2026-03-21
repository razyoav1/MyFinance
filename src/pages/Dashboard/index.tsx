import { useState } from 'react'
import { ChevronLeft, ChevronRight, FileDown } from 'lucide-react'
import { useMonthlyStats, useSpendingByCategory, useMonthlyTrend, useTransactions } from '@/hooks/useTransactions'
import { usePortfolioTotal } from '@/hooks/useInvestments'
import { useMortgageSummary } from '@/hooks/useMortgage'
import { useGoals } from '@/hooks/useGoals'
import { useNetWorth } from '@/hooks/useNetWorth'
import { useCurrencyStore } from '@/store/useCurrencyStore'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatCompact } from '@/lib/currency'
import { calcSavingsRate } from '@/lib/financeCalc'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { generateMonthlyReport } from '@/lib/monthlyReport'
import { toast } from '@/store/useToastStore'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const now = new Date()

export function Dashboard() {
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear]  = useState(now.getFullYear())
  const [exporting, setExporting] = useState(false)

  const { baseCurrency, exchangeRates } = useCurrencyStore()

  const stats    = useMonthlyStats(year, month)
  const spending = useSpendingByCategory(year, month)
  const trend    = useMonthlyTrend(6)
  const portfolio      = usePortfolioTotal()
  const mortgageSummary = useMortgageSummary()
  const goals    = useGoals()
  const netWorthData = useNetWorth()

  // Transactions for the selected month (all of them)
  const monthTxns = useTransactions({ month, year, type: 'all' })

  const savingsRate = calcSavingsRate(stats.income, stats.expenses)
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await generateMonthlyReport(month, year, baseCurrency, exchangeRates)
      toast.success('PDF report downloaded')
    } catch (e) {
      console.error(e)
      toast.error('Failed to generate PDF')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">

      {/* Header row */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Dashboard</h1>
          {/* Month navigator */}
          <div className="flex items-center gap-1 ml-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-1 py-0.5">
            <button onClick={prevMonth} className="p-1 rounded hover:bg-[var(--color-surface2)] text-[var(--color-text-muted)] transition-colors">
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-[var(--color-text)] min-w-[90px] text-center select-none">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button
              onClick={nextMonth}
              disabled={isCurrentMonth}
              className="p-1 rounded hover:bg-[var(--color-surface2)] text-[var(--color-text-muted)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={15} />
            </button>
          </div>
          {!isCurrentMonth && (
            <button onClick={() => { setMonth(now.getMonth() + 1); setYear(now.getFullYear()) }}
              className="text-xs text-[var(--color-accent)] hover:underline">
              Today
            </button>
          )}
        </div>

        <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}>
          <FileDown size={14} />
          {exporting ? 'Generating…' : 'Export PDF'}
        </Button>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Monthly Income',   value: formatCompact(stats.income,   baseCurrency), color: 'text-emerald-500' },
          { label: 'Monthly Expenses', value: formatCompact(stats.expenses, baseCurrency), color: 'text-red-500' },
          { label: 'Net Worth',        value: formatCompact(netWorthData.netWorth, netWorthData.baseCurrency), color: netWorthData.netWorth >= 0 ? 'text-emerald-500' : 'text-red-500' },
          { label: 'Savings Rate',     value: `${savingsRate.toFixed(0)}%`, color: savingsRate >= 20 ? 'text-emerald-500' : 'text-amber-500' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">

        {/* Spending by category */}
        <Card>
          <CardHeader><CardTitle>Spending by Category</CardTitle></CardHeader>
          {spending.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No expenses this month</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={spending} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85}>
                    {spending.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => formatCurrency(val, baseCurrency)}
                    contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}
                    labelStyle={{ color: 'var(--color-text)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className={`mt-2 grid gap-x-4 gap-y-1.5 px-2 pb-2 ${
                spending.length >= 9 ? 'grid-cols-3' : spending.length >= 5 ? 'grid-cols-2' : 'grid-cols-1'
              }`}>
                {spending.map(entry => (
                  <div key={entry.name} className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs text-[var(--color-text)] truncate">{entry.icon} {entry.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Income vs Expenses trend */}
        <Card>
          <CardHeader><CardTitle>Income vs Expenses (6 months)</CardTitle></CardHeader>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--color-text)' }}
                formatter={(val: number) => formatCurrency(val, baseCurrency)}
              />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Transactions this month */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Transactions — {MONTH_NAMES[month - 1]}</CardTitle>
              <span className="text-xs text-[var(--color-text-muted)]">{monthTxns.length} total</span>
            </div>
          </CardHeader>
          {monthTxns.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No transactions this month</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {monthTxns.slice(0, 10).map(t => (
                <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)] last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">{t.category?.icon ?? '💳'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text)] truncate">{t.description}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{t.date}</p>
                    </div>
                  </div>
                  <span className={`font-semibold text-sm shrink-0 ml-2 ${t.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, t.currency)}
                  </span>
                </div>
              ))}
              {monthTxns.length > 10 && (
                <p className="text-xs text-[var(--color-text-muted)] text-center pt-1">
                  +{monthTxns.length - 10} more — see Transactions page
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Savings Goals */}
        <Card>
          <CardHeader><CardTitle>Savings Goals</CardTitle></CardHeader>
          {goals.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No goals yet — add one in Goals</p>
          ) : (
            <div className="flex flex-col gap-3">
              {goals.filter(g => !g.isCompleted).slice(0, 4).map(goal => {
                const pct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0
                return (
                  <div key={goal.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-[var(--color-text)]">{goal.icon} {goal.name}</span>
                      <span className="text-[var(--color-text-muted)]">{pct.toFixed(0)}%</span>
                    </div>
                    <ProgressBar value={pct} color={goal.color} size="sm" />
                    <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
                      <span>{formatCurrency(goal.currentAmount, goal.currency)}</span>
                      <span>{formatCurrency(goal.targetAmount, goal.currency)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Mortgage snapshot */}
        {mortgageSummary && (
          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Mortgage — {mortgageSummary.mortgage.propertyName}</CardTitle></CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Current Balance',   value: formatCurrency(mortgageSummary.currentBalance, mortgageSummary.mortgage.currency) },
                { label: 'Monthly Payment',   value: formatCurrency(mortgageSummary.mortgage.monthlyPayment, mortgageSummary.mortgage.currency) },
                { label: 'Months Remaining',  value: mortgageSummary.monthsRemaining },
                { label: 'Payoff Date',       value: mortgageSummary.payoffDate ?? '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
                  <p className="font-semibold text-[var(--color-text)] mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            <ProgressBar
              value={((mortgageSummary.mortgage.originalAmount - mortgageSummary.currentBalance) / mortgageSummary.mortgage.originalAmount) * 100}
              color="var(--color-primary)"
              className="mt-4"
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {formatCurrency(mortgageSummary.totalPrincipalPaid, mortgageSummary.mortgage.currency)} paid of{' '}
              {formatCurrency(mortgageSummary.mortgage.originalAmount, mortgageSummary.mortgage.currency)}
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
