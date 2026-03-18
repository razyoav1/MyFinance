import { useMonthlyStats, useSpendingByCategory, useMonthlyTrend } from '@/hooks/useTransactions'
import { usePortfolioTotal } from '@/hooks/useInvestments'
import { useMortgageSummary } from '@/hooks/useMortgage'
import { useGoals } from '@/hooks/useGoals'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency, formatCompact } from '@/lib/currency'
import { calcSavingsRate } from '@/lib/financeCalc'
import { ProgressBar } from '@/components/ui/ProgressBar'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

const now = new Date()

export function Dashboard() {
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const stats = useMonthlyStats(year, month)
  const spending = useSpendingByCategory(year, month)
  const trend = useMonthlyTrend(6)
  const portfolio = usePortfolioTotal()
  const mortgageSummary = useMortgageSummary()
  const goals = useGoals()

  const recentTxns = useLiveQuery(async () => {
    const all = await db.transactions.orderBy('date').reverse().limit(5).toArray()
    const cats = await db.categories.toArray()
    const catMap = Object.fromEntries(cats.map(c => [c.id!, c]))
    return all.map(t => ({ ...t, category: t.categoryId ? catMap[t.categoryId] : undefined }))
  }) ?? []

  const savingsRate = calcSavingsRate(stats.income, stats.expenses)

  // Net worth estimate
  const netWorth = stats.income - stats.expenses + portfolio.totalCurrent -
    (mortgageSummary?.currentBalance ?? 0)

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold text-[var(--color-text)] mb-4">Dashboard</h1>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Monthly Income', value: formatCompact(stats.income, 'ILS'), color: 'text-emerald-500' },
          { label: 'Monthly Expenses', value: formatCompact(stats.expenses, 'ILS'), color: 'text-red-500' },
          { label: 'Portfolio Value', value: formatCompact(portfolio.totalCurrent, 'USD'), color: 'text-[var(--color-primary)]' },
          { label: 'Savings Rate', value: `${savingsRate.toFixed(0)}%`, color: savingsRate >= 20 ? 'text-emerald-500' : 'text-amber-500' },
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
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          {spending.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No expenses this month</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={spending}
                  dataKey="value"
                  nameKey="name"
                  cx="40%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                >
                  {spending.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number) => formatCurrency(val, 'ILS')}
                  contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}
                  labelStyle={{ color: 'var(--color-text)' }}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  formatter={(value) => <span style={{ color: 'var(--color-text)', fontSize: 12 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Income vs Expenses trend */}
        <Card>
          <CardHeader>
            <CardTitle>Income vs Expenses (6 months)</CardTitle>
          </CardHeader>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--color-text)' }}
                formatter={(val: number) => formatCurrency(val, 'ILS')}
              />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          {recentTxns.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No transactions yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentTxns.map(t => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{t.category?.icon ?? '💳'}</span>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text)]">{t.description}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{t.date}</p>
                    </div>
                  </div>
                  <span className={`font-semibold text-sm ${t.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, t.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Savings Goals summary */}
        <Card>
          <CardHeader>
            <CardTitle>Savings Goals</CardTitle>
          </CardHeader>
          {goals.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No goals yet — add one in Goals</p>
          ) : (
            <div className="flex flex-col gap-3">
              {goals.slice(0, 4).map(goal => {
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
            <CardHeader>
              <CardTitle>Mortgage — {mortgageSummary.mortgage.propertyName}</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Current Balance', value: formatCurrency(mortgageSummary.currentBalance, mortgageSummary.mortgage.currency) },
                { label: 'Monthly Payment', value: formatCurrency(mortgageSummary.mortgage.monthlyPayment, mortgageSummary.mortgage.currency) },
                { label: 'Months Remaining', value: mortgageSummary.monthsRemaining },
                { label: 'Payoff Date', value: mortgageSummary.payoffDate ?? '—' },
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
              {formatCurrency(mortgageSummary.totalPrincipalPaid, mortgageSummary.mortgage.currency)} paid of {formatCurrency(mortgageSummary.mortgage.originalAmount, mortgageSummary.mortgage.currency)}
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
