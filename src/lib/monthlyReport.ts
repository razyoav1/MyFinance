import { db } from '@/db'
import { formatCurrency, getCurrencySymbol, convertCurrency } from './currency'
import { calcSavingsRate } from './financeCalc'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function pad(n: number) { return String(n).padStart(2, '0') }

export async function generateMonthlyReport(
  month: number,
  year: number,
  baseCurrency: string,
  exchangeRates: Record<string, number>,
) {
  const startDate = `${year}-${pad(month)}-01`
  const endDate   = `${year}-${pad(month)}-31`
  const sym = getCurrencySymbol(baseCurrency)
  const toBase = (amount: number, from: string) => convertCurrency(amount, from, baseCurrency, exchangeRates)
  const fmt = (amount: number, currency = baseCurrency) => formatCurrency(amount, currency)

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const [txns, categories, goals, activeMortgage, bankAccounts, holdings] = await Promise.all([
    db.transactions.where('date').between(startDate, endDate, true, true).toArray(),
    db.categories.toArray(),
    db.savingsGoals.toArray(),
    db.mortgages.filter(m => m.isActive).first(),
    db.bankAccounts.toArray(),
    db.investmentHoldings.toArray(),
  ])

  const catMap = Object.fromEntries(categories.map(c => [c.id!, c]))
  const income   = txns.filter(t => t.type === 'income' ).reduce((s, t) => s + toBase(t.amount, t.currency), 0)
  const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + toBase(t.amount, t.currency), 0)
  const net      = income - expenses
  const savingsRate = calcSavingsRate(income, expenses)

  // Spending by category
  const spendMap: Record<number, { name: string; icon: string; color: string; amount: number }> = {}
  txns.filter(t => t.type === 'expense').forEach(t => {
    const id = t.categoryId ?? 0
    if (!spendMap[id]) {
      const cat = catMap[id]
      spendMap[id] = { name: cat?.name ?? 'Uncategorized', icon: cat?.icon ?? '📦', color: cat?.color ?? '#94a3b8', amount: 0 }
    }
    spendMap[id].amount += toBase(t.amount, t.currency)
  })
  const spendRows = Object.values(spendMap).sort((a, b) => b.amount - a.amount)

  // Net Worth
  const totalCash     = bankAccounts.reduce((s, a) => s + toBase(a.balance, a.currency), 0)
  const portfolioBase = holdings.reduce((s, h) => s + toBase(h.currentPrice * h.quantity, h.currentCurrency), 0)
  const netWorth      = totalCash + portfolioBase

  const sorted = [...txns].sort((a, b) => b.date.localeCompare(a.date))
  const activeGoals = goals.filter(g => !g.isCompleted)

  // ── Build HTML ─────────────────────────────────────────────────────────────
  const color = (n: number, pos = '#10b981', neg = '#ef4444') => n >= 0 ? pos : neg
  const sign  = (n: number) => n >= 0 ? '+' : ''

  const summaryCards = [
    { label: 'Income',       value: fmt(income),    cls: 'green' },
    { label: 'Expenses',     value: fmt(expenses),  cls: 'red' },
    { label: 'Net',          value: fmt(net),       cls: net >= 0 ? 'green' : 'red' },
    { label: 'Savings Rate', value: `${savingsRate.toFixed(0)}%`, cls: savingsRate >= 20 ? 'green' : 'amber' },
  ]

  const spendTable = spendRows.length === 0 ? '<p class="muted">No expenses this month.</p>' : `
    <table>
      <thead><tr><th>Category</th><th>Amount</th><th style="text-align:right">% of Total</th></tr></thead>
      <tbody>
        ${spendRows.map(r => `
          <tr>
            <td>${r.icon} ${r.name}</td>
            <td style="text-align:right">${fmt(r.amount)}</td>
            <td style="text-align:right">${expenses > 0 ? ((r.amount / expenses) * 100).toFixed(1) : 0}%</td>
          </tr>`).join('')}
      </tbody>
    </table>`

  const txnTable = sorted.length === 0 ? '<p class="muted">No transactions this month.</p>' : `
    <table>
      <thead><tr><th>Date</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        ${sorted.map(t => {
          const cat = t.categoryId ? catMap[t.categoryId] : undefined
          const amtFormatted = fmt(t.amount, t.currency)
          const cls = t.type === 'income' ? 'green' : 'red'
          const prefix = t.type === 'income' ? '+' : '−'
          return `
          <tr>
            <td style="white-space:nowrap">${t.date}</td>
            <td>${t.description}${t.notes ? `<br><span class="muted" style="font-size:9px">${t.notes}</span>` : ''}</td>
            <td>${cat ? `${cat.icon} ${cat.name}` : '—'}</td>
            <td style="text-align:right;font-weight:600" class="${cls}">${prefix}${amtFormatted}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>`

  const goalsTable = activeGoals.length === 0 ? '<p class="muted">No active savings goals.</p>' : `
    <table>
      <thead><tr><th>Goal</th><th style="text-align:right">Saved</th><th style="text-align:right">Target</th><th style="text-align:right">Progress</th></tr></thead>
      <tbody>
        ${activeGoals.map(g => {
          const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0
          return `
          <tr>
            <td>${g.icon} ${g.name}</td>
            <td style="text-align:right">${fmt(g.currentAmount, g.currency)}</td>
            <td style="text-align:right">${fmt(g.targetAmount, g.currency)}</td>
            <td style="text-align:right">
              <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${g.color}"></div></div>
              <span>${pct.toFixed(0)}%</span>
            </td>
          </tr>`
        }).join('')}
      </tbody>
    </table>`

  const nwSection = (bankAccounts.length > 0 || holdings.length > 0) ? `
    <div class="section">
      <div class="section-title">Net Worth Snapshot</div>
      <table>
        <tbody>
          ${bankAccounts.length > 0 ? `<tr><td>Cash &amp; Bank Accounts</td><td style="text-align:right;font-weight:600">${fmt(totalCash)}</td></tr>` : ''}
          ${holdings.length > 0 ? `<tr><td>Investment Portfolio</td><td style="text-align:right;font-weight:600">${fmt(portfolioBase)}</td></tr>` : ''}
          ${activeMortgage ? `<tr><td>Mortgage (est. liability)</td><td style="text-align:right;font-weight:600;color:#ef4444">−${fmt(toBase(activeMortgage.originalAmount * 0.5, activeMortgage.currency))}</td></tr>` : ''}
          <tr class="nw-total"><td><strong>Net Worth</strong></td><td style="text-align:right;color:${color(netWorth)}"><strong>${fmt(netWorth)}</strong></td></tr>
        </tbody>
      </table>
    </div>` : ''

  const html = `<!DOCTYPE html>
<html lang="he" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>MyFinance — ${MONTH_NAMES[month - 1]} ${year}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e1e2e; background: #fff; padding: 0; }
    @page { margin: 15mm 12mm; size: A4; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
    @media screen { body { max-width: 800px; margin: 0 auto; padding: 24px; } }

    /* Print button */
    .print-bar { background: #6366f1; color: white; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-radius: 8px; }
    .print-bar span { font-size: 13px; font-weight: 600; }
    .print-bar button { background: white; color: #6366f1; border: none; padding: 6px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 12px; }

    /* Header */
    .header { background: #1e1e32; color: white; padding: 18px 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; }
    .header h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header .sub { font-size: 13px; opacity: 0.75; margin-top: 4px; }
    .header .gen { font-size: 10px; opacity: 0.5; text-align: right; }

    /* Summary cards */
    .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
    .card { background: #f5f5fc; border-radius: 8px; padding: 12px 14px; }
    .card .lbl { font-size: 9.5px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .card .val { font-size: 15px; font-weight: 700; margin-top: 5px; }
    .green { color: #10b981; } .red { color: #ef4444; } .amber { color: #f59e0b; }

    /* Sections */
    .section { margin-bottom: 22px; page-break-inside: avoid; }
    .section-title { font-size: 13px; font-weight: 700; color: #1e1e32; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; margin-bottom: 12px; }
    .muted { color: #888; font-size: 10px; padding: 8px 0; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #1e1e32; color: #fff; padding: 7px 10px; text-align: left; font-size: 9.5px; font-weight: 600; letter-spacing: 0.3px; }
    td { padding: 6px 10px; border-bottom: 1px solid #f0f0f5; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #fafafa; }
    .nw-total td { background: #1e1e32 !important; color: white; padding: 8px 10px; }

    /* Progress bar */
    .progress-bar { height: 5px; background: #e5e7eb; border-radius: 3px; margin-bottom: 3px; overflow: hidden; width: 80px; display: inline-block; vertical-align: middle; margin-right: 6px; }
    .progress-fill { height: 100%; border-radius: 3px; }

    /* Txn table — description col can wrap */
    .txn-desc { max-width: 200px; word-break: break-word; }

    /* Footer */
    .footer { text-align: center; color: #bbb; font-size: 9px; margin-top: 24px; padding-top: 12px; border-top: 1px solid #eee; }
    @media print { .footer { position: running(footer); } }
  </style>
</head>
<body>

  <div class="no-print print-bar">
    <span>📄 MyFinance Report — ${MONTH_NAMES[month - 1]} ${year}</span>
    <button onclick="window.print()">Save as PDF / Print</button>
  </div>

  <!-- Header -->
  <div class="header">
    <div>
      <h1>MyFinance</h1>
      <div class="sub">Monthly Report — ${MONTH_NAMES[month - 1]} ${year}</div>
    </div>
    <div class="gen">Generated<br>${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
  </div>

  <!-- Financial Summary -->
  <div class="section">
    <div class="section-title">Financial Summary</div>
    <div class="cards">
      ${summaryCards.map(c => `
        <div class="card">
          <div class="lbl">${c.label}</div>
          <div class="val ${c.cls}">${c.value}</div>
        </div>`).join('')}
    </div>
  </div>

  <!-- Spending by Category -->
  <div class="section">
    <div class="section-title">Spending by Category</div>
    ${spendTable}
  </div>

  <!-- Transactions -->
  <div class="section">
    <div class="section-title">Transactions (${sorted.length})</div>
    ${txnTable}
  </div>

  <!-- Savings Goals -->
  <div class="section">
    <div class="section-title">Savings Goals</div>
    ${goalsTable}
  </div>

  ${nwSection}

  <div class="footer">
    MyFinance &nbsp;·&nbsp; ${MONTH_NAMES[month - 1]} ${year} &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
  </div>

</body>
</html>`

  // Open in new window and print
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) { alert('Please allow popups for this site to export the PDF.'); return }
  win.document.write(html)
  win.document.close()
}
