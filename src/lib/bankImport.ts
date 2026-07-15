import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { parse, isValid } from 'date-fns'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParsedFile {
  fileName: string
  headers: string[]
  rows: string[][]
  /** Intro rows (account info, date range…) skipped above the real table */
  skippedRows: number
}

export interface ColumnMapping {
  date: number | null
  description: number | null
  amount: number | null    // signed: negative = expense, positive = income
  credit: number | null    // income-only column (positive = income)
  debit: number | null     // expense-only column (positive = expense)
  notes: number | null
}

export interface ImportRow {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  notes?: string
  raw: string[]
  valid: boolean
  error?: string
}

// ─── File Parsing ─────────────────────────────────────────────────────────────

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  let result: Omit<ParsedFile, 'fileName'>

  if (ext === 'csv' || ext === 'tsv') {
    result = csvToGrid(await readAsText(file))
  } else if (ext === 'xlsx' || ext === 'xls') {
    result = excelToGrid(await readAsBuffer(file))
  } else {
    throw new Error(`Unsupported file type: .${ext}. Use .csv, .xls, or .xlsx.`)
  }

  return { fileName: file.name, ...result }
}

export function csvToGrid(text: string): Omit<ParsedFile, 'fileName'> {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true })
  if (result.data.length === 0) throw new Error('The file appears to be empty.')
  return finalizeGrid((result.data as string[][]).map(row => row.map(c => String(c ?? '').trim())))
}

export function excelToGrid(buffer: ArrayBuffer | Uint8Array): Omit<ParsedFile, 'fileName'> {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('Excel file has no sheets.')
  const raw = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(ws, { header: 1, defval: '' })
  if (raw.length === 0) throw new Error('The file appears to be empty.')

  const stringify = (v: string | number | Date | null): string => {
    if (v instanceof Date) {
      const d = String(v.getDate()).padStart(2, '0')
      const m = String(v.getMonth() + 1).padStart(2, '0')
      return `${d}/${m}/${v.getFullYear()}`
    }
    return String(v ?? '').trim()
  }

  return finalizeGrid((raw as (string | number | Date | null)[][]).map(row => row.map(stringify)))
}

function finalizeGrid(grid: string[][]): Omit<ParsedFile, 'fileName'> {
  const headerIdx = findHeaderRow(grid)
  return {
    headers: grid[headerIdx] ?? [],
    rows: grid.slice(headerIdx + 1),
    skippedRows: headerIdx,
  }
}

function readAsText(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = e => res(e.target?.result as string)
    reader.onerror = () => rej(new Error('Could not read file'))
    reader.readAsText(file, 'UTF-8')
  })
}

function readAsBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = e => res(e.target?.result as ArrayBuffer)
    reader.onerror = () => rej(new Error('Could not read file'))
    reader.readAsArrayBuffer(file)
  })
}

// ─── Header Row Detection ─────────────────────────────────────────────────────
// Israeli bank exports (Hapoalim, Leumi, Discount, Mizrahi, credit cards) start
// with intro rows — account number, "מתאריך: … עד תאריך: …" — before the real
// table. The header row is the one with the most column-name keywords.

const nh = (s: string) => s.trim().toLowerCase()

const HEADER_KEYWORDS = [
  // English
  'date', 'description', 'amount', 'debit', 'credit', 'balance', 'reference',
  'details', 'payee', 'memo', 'narration', 'currency', 'category',
  // Hebrew — bank accounts
  'תאריך', 'תיאור', 'פרטים', 'סכום', 'חובה', 'זכות', 'יתרה', 'אסמכתא',
  'פעולה', 'ערך', 'הערות',
  // Hebrew — credit cards
  'בית עסק', 'בית העסק', 'חיוב', 'זיכוי', 'קטגוריה', 'ענף', 'מטבע',
]

function headerScore(row: string[]): number {
  let score = 0
  for (const cell of row) {
    const c = nh(cell)
    if (c && HEADER_KEYWORDS.some(k => c.includes(k))) score++
  }
  return score
}

export function findHeaderRow(grid: string[][]): number {
  let best = 0
  let bestScore = 0
  const limit = Math.min(grid.length, 30)
  for (let i = 0; i < limit; i++) {
    const score = headerScore(grid[i])
    // strictly greater: on ties keep the earliest qualifying row
    if (score >= 2 && score > bestScore) { best = i; bestScore = score }
  }
  return bestScore >= 2 ? best : 0
}

// ─── Auto-detect Column Mapping ───────────────────────────────────────────────

export function autoDetectMapping(headers: string[]): Partial<ColumnMapping> {
  const h = headers.map(nh)
  const isDateCol = (x: string) => x.includes('date') || x.includes('תאריך')
  const isBalanceCol = (x: string) => x.includes('balance') || x.includes('יתרה')
  const find = (...terms: string[]) => h.findIndex(x => terms.some(t => x.includes(t)))
  // Non-date fields must never land on a date column ("תאריך חיוב" contains "חיוב")
  const findNonDate = (...terms: string[]) =>
    h.findIndex(x => !isDateCol(x) && terms.some(t => x.includes(t)))

  const mapping: Partial<ColumnMapping> = {}

  const dateIdx = find('תאריך', 'date', 'datum', 'fecha')
  if (dateIdx >= 0) mapping.date = dateIdx

  const descIdx = findNonDate(
    'description', 'פרטים', 'תיאור', 'details', 'payee', 'memo', 'narration',
    'תנועה', 'בית עסק', 'בית העסק', 'שם בית',
  )
  if (descIdx >= 0) mapping.description = descIdx

  let creditIdx = findNonDate('credit', 'זכות', 'income', 'deposit', 'received', 'זיכוי')
  let debitIdx = findNonDate('debit', 'חובה', 'expense', 'withdrawal', 'charge', 'paid', 'חיוב')

  // A single "debit/credit" column matched both → it's really a signed amount
  if (creditIdx >= 0 && creditIdx === debitIdx) {
    mapping.amount = creditIdx
    creditIdx = -1
    debitIdx = -1
  }

  if (creditIdx >= 0) mapping.credit = creditIdx
  if (debitIdx >= 0) mapping.debit = debitIdx

  // Single amount column only if no credit/debit found (never the balance column)
  if (mapping.amount === undefined && mapping.credit === undefined && mapping.debit === undefined) {
    const amtIdx = h.findIndex(x =>
      !isDateCol(x) && !isBalanceCol(x) &&
      ['amount', 'סכום', 'sum', 'total', 'value', 'price'].some(t => x.includes(t)))
    if (amtIdx >= 0) mapping.amount = amtIdx
  }

  const notesIdx = findNonDate('notes', 'הערות', 'remark', 'comment', 'אסמכתא', 'reference')
  if (notesIdx >= 0 && notesIdx !== descIdx) mapping.notes = notesIdx

  return mapping
}

export function detectBankName(headers: string[]): string | null {
  const h = headers.map(nh)
  const has = (...t: string[]) => t.some(x => h.some(hx => hx.includes(x)))

  if (has('בית עסק', 'בית העסק')) return 'Israeli Credit Card'
  if (has('תאריך') && has('פרטים', 'תיאור', 'פעולה')) return 'Israeli Bank'
  if (has('date') && has('amount') && has('description')) return 'Generic CSV'
  if (has('date') && (has('credit') || has('debit'))) return 'Bank Statement (Credit/Debit)'
  return null
}

// ─── Date Parsing ────────────────────────────────────────────────────────────

const DATE_FORMATS = [
  'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd',
  'dd-MM-yyyy', 'MM-dd-yyyy', 'd/M/yyyy', 'M/d/yyyy',
  'dd.MM.yyyy', 'yyyy/MM/dd',
  // 2-digit years (Hapoalim & credit cards) — must come after 4-digit formats
  'dd/MM/yy', 'd/M/yy', 'dd.MM.yy', 'dd-MM-yy',
]

export function parseDate(str: string): string | null {
  const s = str?.trim()
  if (!s) return null
  for (const fmt of DATE_FORMATS) {
    const d = parse(s, fmt, new Date())
    if (isValid(d) && d.getFullYear() > 1970 && d.getFullYear() < 2100) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${dd}`
    }
  }
  return null
}

export function parseAmount(str: string): number | null {
  const s = str?.trim()
  if (!s) return null
  const cleaned = s.replace(/[₪$€£,\s ]/g, '').replace(/\(([^)]+)\)/, '-$1')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

// ─── Row Conversion ───────────────────────────────────────────────────────────

export function mapRows(rows: string[][], mapping: ColumnMapping): ImportRow[] {
  const get = (row: string[], idx: number | null) =>
    idx !== null && idx < row.length ? row[idx].trim() : ''

  return rows
    .filter(row => row.some(cell => cell.trim() !== ''))
    .map((row, i) => {
      const rawDate = get(row, mapping.date)
      const date = parseDate(rawDate)
      if (!date) {
        return { date: '', description: '', amount: 0, type: 'expense' as const, raw: row, valid: false, error: `Invalid date: "${rawDate}"` }
      }

      const description = get(row, mapping.description) || `Row ${i + 1}`
      const notes = mapping.notes !== null ? get(row, mapping.notes) || undefined : undefined

      let amount: number | null = null
      let type: 'income' | 'expense' = 'expense'

      if (mapping.credit !== null || mapping.debit !== null) {
        const credit = parseAmount(get(row, mapping.credit))
        const debit  = parseAmount(get(row, mapping.debit))
        if (credit !== null && credit > 0) { amount = credit; type = 'income' }
        else if (debit !== null && debit > 0) { amount = debit; type = 'expense' }
        else if (credit !== null && credit < 0) { amount = Math.abs(credit); type = 'expense' }
        else if (debit !== null && debit < 0) { amount = Math.abs(debit); type = 'income' }
      } else if (mapping.amount !== null) {
        const raw = parseAmount(get(row, mapping.amount))
        if (raw !== null) { amount = Math.abs(raw); type = raw >= 0 ? 'income' : 'expense' }
      }

      if (amount === null || amount === 0) {
        return { date, description, amount: 0, type: 'expense' as const, raw: row, valid: false, error: 'Missing or zero amount' }
      }

      return { date, description, amount, type, notes: notes || undefined, raw: row, valid: true }
    })
}
