import { useState } from 'react'
import { useMortgageSummary, useMortgagePayments, addMortgage, updateMortgage, logMortgagePayment } from '@/hooks/useMortgage'
import { calcMonthlyPayment, buildAmortizationSchedule } from '@/lib/mortgageCalc'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/currency'
import { CURRENCIES } from '@/types'
import { format } from 'date-fns'

const TABS = ['Summary', 'Schedule', 'Payments'] as const

export function Mortgage() {
  const summary = useMortgageSummary()
  const [tab, setTab] = useState<typeof TABS[number]>('Summary')
  const [setupOpen, setSetupOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [setupForm, setSetupForm] = useState({
    propertyName: 'My Home',
    originalAmount: '',
    currency: 'ILS',
    interestRate: '',
    termYears: '30',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    extraMonthlyPayment: '0',
    rateType: 'fixed',
  })
  const [payForm, setPayForm] = useState({
    totalPaid: '', principalPaid: '', interestPaid: '', balanceAfter: '', paymentDate: format(new Date(), 'yyyy-MM-dd'),
  })

  const setS = (k: string, v: string) => setSetupForm(f => ({ ...f, [k]: v }))
  const setP = (k: string, v: string) => setPayForm(f => ({ ...f, [k]: v }))

  const autoCalcPayment = () => {
    const p = parseFloat(setupForm.originalAmount)
    const r = parseFloat(setupForm.interestRate)
    const n = parseInt(setupForm.termYears) * 12
    if (!p || !r || !n) return ''
    return calcMonthlyPayment(p, r, n).toFixed(2)
  }

  const handleSetup = async () => {
    setSaving(true)
    const termMonths = parseInt(setupForm.termYears) * 12
    const monthlyPayment = parseFloat(autoCalcPayment() || '0')
    const data = {
      propertyName: setupForm.propertyName,
      originalAmount: parseFloat(setupForm.originalAmount),
      currency: setupForm.currency,
      interestRate: parseFloat(setupForm.interestRate),
      termMonths,
      startDate: setupForm.startDate,
      monthlyPayment,
      extraMonthlyPayment: parseFloat(setupForm.extraMonthlyPayment) || 0,
      rateType: setupForm.rateType as 'fixed' | 'variable',
      isActive: true,
    }
    if (summary?.mortgage.id) {
      await updateMortgage(summary.mortgage.id, data)
    } else {
      await addMortgage(data)
    }
    setSaving(false)
    setSetupOpen(false)
  }

  const handleLogPayment = async () => {
    if (!summary?.mortgage.id) return
    setSaving(true)
    await logMortgagePayment({
      mortgageId: summary.mortgage.id,
      paymentDate: payForm.paymentDate,
      totalPaid: parseFloat(payForm.totalPaid),
      principalPaid: parseFloat(payForm.principalPaid),
      interestPaid: parseFloat(payForm.interestPaid),
      balanceAfter: parseFloat(payForm.balanceAfter),
    })
    setSaving(false)
    setPaymentOpen(false)
  }

  if (!summary) {
    return (
      <div className="p-4 max-w-5xl mx-auto">
        <h1 className="text-xl font-bold text-[var(--color-text)] mb-4">Mortgage</h1>
        <EmptyState
          icon="🏠"
          title="No mortgage set up"
          description="Add your mortgage details to track payments and see your amortization schedule."
          action={<Button onClick={() => setSetupOpen(true)}><span>Set Up Mortgage</span></Button>}
        />
        <Modal open={setupOpen} onClose={() => setSetupOpen(false)} title="Set Up Mortgage" size="md">
          <MortgageSetupForm form={setupForm} setF={setS} autoPayment={autoCalcPayment()} onSave={handleSetup} saving={saving} onClose={() => setSetupOpen(false)} />
        </Modal>
      </div>
    )
  }

  const { mortgage, currentBalance, totalPaid, totalInterestPaid, monthsPaid, monthsRemaining, payoffDate, totalInterestRemaining, schedule } = summary
  const paidPct = ((mortgage.originalAmount - currentBalance) / mortgage.originalAmount) * 100

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[var(--color-text)]">Mortgage — {mortgage.propertyName}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSetupOpen(true)}>Edit</Button>
          <Button size="sm" onClick={() => {
            setPayForm({
              totalPaid: String(mortgage.monthlyPayment),
              principalPaid: '',
              interestPaid: (currentBalance * mortgage.interestRate / 100 / 12).toFixed(2),
              balanceAfter: '',
              paymentDate: format(new Date(), 'yyyy-MM-dd'),
            })
            setPaymentOpen(true)
          }}>Log Payment</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-[var(--color-border)]">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Summary' && (
        <div className="flex flex-col gap-4">
          {/* Progress */}
          <Card>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[var(--color-text-muted)]">Loan paid off</span>
              <span className="font-semibold text-[var(--color-text)]">{paidPct.toFixed(1)}%</span>
            </div>
            <ProgressBar value={paidPct} />
            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
              <span>Paid: {formatCurrency(totalPaid, mortgage.currency)}</span>
              <span>Original: {formatCurrency(mortgage.originalAmount, mortgage.currency)}</span>
            </div>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Current Balance', value: formatCurrency(currentBalance, mortgage.currency) },
              { label: 'Monthly Payment', value: formatCurrency(mortgage.monthlyPayment, mortgage.currency) },
              { label: 'Interest Rate', value: `${mortgage.interestRate}%` },
              { label: 'Months Remaining', value: String(monthsRemaining) },
              { label: 'Total Interest Paid', value: formatCurrency(totalInterestPaid, mortgage.currency) },
              { label: 'Total Interest Left', value: formatCurrency(totalInterestRemaining, mortgage.currency) },
              { label: 'Payments Made', value: String(monthsPaid) },
              { label: 'Payoff Date', value: payoffDate ?? '—' },
            ].map(({ label, value }) => (
              <Card key={label}>
                <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
                <p className="font-semibold text-[var(--color-text)] mt-0.5">{value}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === 'Schedule' && (
        <Card>
          <CardHeader><CardTitle>Amortization Schedule</CardTitle></CardHeader>
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--color-surface)]">
                <tr className="border-b border-[var(--color-border)]">
                  {['#', 'Date', 'Payment', 'Principal', 'Interest', 'Balance'].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <tr key={row.month} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface2)] text-xs">
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">{row.month}</td>
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">{row.date}</td>
                    <td className="px-3 py-2 font-medium">{formatCurrency(row.payment, mortgage.currency)}</td>
                    <td className="px-3 py-2 text-emerald-500">{formatCurrency(row.principal, mortgage.currency)}</td>
                    <td className="px-3 py-2 text-red-500">{formatCurrency(row.interest, mortgage.currency)}</td>
                    <td className="px-3 py-2">{formatCurrency(row.balance, mortgage.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'Payments' && (
        <div>
          <Button size="sm" className="mb-4" onClick={() => setPaymentOpen(true)}><span>+ Log Payment</span></Button>
          {/* Payment history from hook */}
          <PaymentHistoryTable mortgageId={mortgage.id!} currency={mortgage.currency} />
        </div>
      )}

      {/* Edit modal */}
      <Modal open={setupOpen} onClose={() => setSetupOpen(false)} title="Edit Mortgage" size="md">
        <MortgageSetupForm form={setupForm} setF={setS} autoPayment={autoCalcPayment()} onSave={handleSetup} saving={saving} onClose={() => setSetupOpen(false)} />
      </Modal>

      {/* Log payment modal */}
      <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Log Payment" size="sm">
        <div className="flex flex-col gap-3">
          <Input label="Payment Date" type="date" value={payForm.paymentDate} onChange={e => setP('paymentDate', e.target.value)} />
          <Input label="Total Paid" type="number" step="0.01" value={payForm.totalPaid} onChange={e => setP('totalPaid', e.target.value)} />
          <Input label="Principal" type="number" step="0.01" value={payForm.principalPaid} onChange={e => setP('principalPaid', e.target.value)} />
          <Input label="Interest" type="number" step="0.01" value={payForm.interestPaid} onChange={e => setP('interestPaid', e.target.value)} />
          <Input label="Balance After" type="number" step="0.01" value={payForm.balanceAfter} onChange={e => setP('balanceAfter', e.target.value)} />
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleLogPayment} disabled={saving}>Log</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function MortgageSetupForm({ form, setF, autoPayment, onSave, saving, onClose }: {
  form: Record<string, string>
  setF: (k: string, v: string) => void
  autoPayment: string
  onSave: () => void
  saving: boolean
  onClose: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <Input label="Property Name" value={form.propertyName} onChange={e => setF('propertyName', e.target.value)} />
      <div className="flex gap-2">
        <Input label="Loan Amount" type="number" step="1000" value={form.originalAmount} onChange={e => setF('originalAmount', e.target.value)} className="flex-1" />
        <Select label="Currency" value={form.currency} onChange={e => setF('currency', e.target.value)} className="w-24">
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
        </Select>
      </div>
      <div className="flex gap-2">
        <Input label="Annual Interest Rate (%)" type="number" step="0.01" value={form.interestRate} onChange={e => setF('interestRate', e.target.value)} className="flex-1" />
        <Input label="Term (years)" type="number" step="1" value={form.termYears} onChange={e => setF('termYears', e.target.value)} className="w-28" />
      </div>
      <div className="flex gap-2">
        <Input label="Start Date" type="date" value={form.startDate} onChange={e => setF('startDate', e.target.value)} className="flex-1" />
        <Select label="Rate Type" value={form.rateType} onChange={e => setF('rateType', e.target.value)} className="flex-1">
          <option value="fixed">Fixed</option>
          <option value="variable">Variable</option>
        </Select>
      </div>
      <Input label="Extra Monthly Payment" type="number" step="100" value={form.extraMonthlyPayment} onChange={e => setF('extraMonthlyPayment', e.target.value)} />
      {autoPayment && (
        <p className="text-xs text-[var(--color-text-muted)]">Calculated monthly payment: <strong>{autoPayment}</strong></p>
      )}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" onClick={onSave} disabled={saving || !form.originalAmount || !form.interestRate}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

function PaymentHistoryTable({ mortgageId, currency }: { mortgageId: number; currency: string }) {
  const payments = useMortgagePayments(mortgageId)
  if (payments.length === 0) return <p className="text-sm text-[var(--color-text-muted)]">No payments logged yet.</p>
  return (
    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface2)]">
            {['Date', 'Total Paid', 'Principal', 'Interest', 'Balance After'].map(h => (
              <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...payments].reverse().map(p => (
            <tr key={p.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface2)]">
              <td className="px-4 py-2 text-[var(--color-text-muted)]">{p.paymentDate}</td>
              <td className="px-4 py-2">{formatCurrency(p.totalPaid, currency)}</td>
              <td className="px-4 py-2 text-emerald-500">{formatCurrency(p.principalPaid, currency)}</td>
              <td className="px-4 py-2 text-red-500">{formatCurrency(p.interestPaid, currency)}</td>
              <td className="px-4 py-2">{formatCurrency(p.balanceAfter, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
