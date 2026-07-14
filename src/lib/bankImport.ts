import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { parse, isValid } from 'date-fns'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParsedFile {
  fileName: string
  headers: string[]
  rows: string[][]
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
  let result: { headers: string[]; rows: string[][] }

  if (ext === 'csv' || ext === 'tsv') {
    result = await parseCsv(file)
  } else if (ext === 'xlsx' || ext === 'xls') {
    result = await parseExcel(file)
  } else {
    throw new Error(`Unsupported file type: .${ext}. Use .csv, .xls, or .xlsx.`)
  }

  return { fileName: file.name, ...result }
}

async function parseCsv(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const text = await readAsText(file)
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true })
  if (result.data.length === 0) throw new Error('The file appears to be empty.')
  const [headers, ...rows] = result.data as string[][]
  return { headers, rows }
}

async function parseExcel(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const buffer = await readAsBuffer(file)
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

  const [headers, ...rows] = (raw as (string | number | Date | null)[][]).map(row => row.map(stringify))
  return { headers, rows }
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

// ─── Auto-detect Column Mapping ───────────────────────────────────────────────

const nh = (s: string) => s.trim().toLowerCase()

export function autoDetectMapping(headers: string[]): Partial<ColumnMapping> {
  const h = headers.map(nh)
  const find = (...terms: string[]) => h.findIndex(x => terms.some(t => x.includes(t)))

  const mapping: Partial<ColumnMapping> = {}

  const dateIdx = find('date', 'תאריך', 'datum', 'fecha')
  if (dateIdx >= 0) mapping.date = dateIdx

  const descIdx = find('description', 'פרטים', 'תיאור', 'details', 'payee', 'memo', 'reference', 'narration', 'תנועה')
  if (descIdx >= 0) mapping.description = descIdx

  const creditIdx = find('credit', 'זכות', 'income', 'deposit', 'credits', 'received')
  const debitIdx = find('debit', 'חובה', 'expense', 'withdrawal', 'charge', 'debits', 'paid')

  if (creditIdx >= 0) mapping.credit = creditIdx
  if (debitIdx >= 0) mapping.debit = debitIdx

  // Single amount column only if no credit/debit found
  if (mapping.credit === undefined && mapping.debit === undefined) {
    const amtIdx = find('amount', 'סכום', 'sum', 'total', 'value', 'price')
    if (amtIdx >= 0) mapping.amount = amtIdx
  }

  const notesIdx = find('notes', 'note', 'הערות', 'remark', 'comment')
  if (notesIdx >= 0 && notesIdx !== descIdx) mapping.notes = notesIdx

  return mapping
}

export function detectBankName(headers: string[]): string | null {
  const h = headers.map(nh)
  const has = (...t: string[]) => t.some(x => h.some(hx => hx.includes(x)))

  if (has('תאריך') && has('פרטים', 'תיאור')) return 'Israeli Bank (Auto-detected)'
  if (has('date') && has('amount') && has('description')) return 'Generic CSV'
  if (has('date') && (has('credit') || has('debit'))) return 'Bank Statement (Credit/Debit)'
  return null
}

// ─── Date Parsing ────────────────────────────────────────────────────────────

const DATE_FORMATS = [
  'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd',
  'dd-MM-yyyy', 'MM-dd-yyyy', 'd/M/yyyy', 'M/d/yyyy',
  'dd.MM.yyyy', 'yyyy/MM/dd',
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
  const cleaned = s.replace(/[₪$€£,\s ]/g, '').replace(/\(([^)]+)\)/, '-$1')
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
