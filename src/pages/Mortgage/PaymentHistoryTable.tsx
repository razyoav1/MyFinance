import { useMortgagePayments } from '@/hooks/useMortgage'
import { formatCurrency } from '@/lib/currency'

export function PaymentHistoryTable({ mortgageId, currency }: { mortgageId: number; currency: string }) {
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
