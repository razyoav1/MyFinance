import { useState, useCallback, useRef } from 'react'
import { Upload, Check, AlertCircle, ChevronRight } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { db } from '@/db'
import { useCurrencyStore } from '@/store/useCurrencyStore'
import { toast } from '@/store/useToastStore'
import { cn } from '@/lib/cn'
import {
  parseFile, autoDetectMapping, mapRows, detectBankName,
  type ParsedFile, type ColumnMapping, type ImportRow,
} from '@/lib/bankImport'

const CURRENCIES = ['ILS', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF']

const COLUMN_ROLES: { key: keyof ColumnMapping; label: string; hint: string }[] = [
  { key: 'date',        label: 'Date',              hint: 'The transaction date' },
  { key: 'description', label: 'Description',       hint: 'Merchant / transaction name' },
  { key: 'amount',      label: 'Amount (signed)',   hint: 'Negative = expense, positive = income' },
  { key: 'credit',      label: 'Credit / Income',   hint: 'Income-only column' },
  { key: 'debit',       label: 'Debit / Expense',   hint: 'Expense-only column' },
  { key: 'notes',       label: 'Notes (optional)',  hint: 'Extra memo / reference text' },
]

type Step = 'upload' | 'map' | 'preview'

const EMPTY_MAPPING: ColumnMapping = {
  date: null, description: null, amount: null,
  credit: null, debit: null, notes: null,
}

interface Props {
  open: boolean
  onClose: () => void
}

export function ImportModal({ open, onClose }: Props) {
  const { baseCurrency } = useCurrencyStore()

  const [step, setStep]           = useState<Step>('upload')
  const [isDragging, setDragging] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [parsed, setParsed]       = useState<ParsedFile | null>(null)
  const [bankName, setBankName]   = useState<string | null>(null)
  const [mapping, setMapping]     = useState<ColumnMapping>(EMPTY_MAPPING)
  const [currency, setCurrency]   = useState(baseCurrency)
  const [rows, setRows]           = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [autoMapped, setAutoMapped] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError(null)
    setLoading(true)
    try {
      const result = await parseFile(file)
      const detected = autoDetectMapping(result.headers)
      const fullMapping = { ...EMPTY_MAPPING, ...detected }
      setParsed(result)
      setBankName(detectBankName(result.headers))
      setMapping(fullMapping)

      // If we recognized the columns, skip the mapping screen entirely
      const complete =
        fullMapping.date !== null &&
        fullMapping.description !== null &&
        (fullMapping.amount !== null || fullMapping.credit !== null || fullMapping.debit !== null)
      const mapped = complete ? mapRows(result.rows, fullMapping) : []

      if (complete && mapped.some(r => r.valid)) {
        setRows(mapped)
        setAutoMapped(true)
        setStep('preview')
      } else {
        setAutoMapped(false)
        setStep('map')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const setCol = (key: keyof ColumnMapping, val: string) =>
    setMapping(m => ({ ...m, [key]: val === '' ? null : Number(val) }))

  const canProceedToPreview =
    mapping.date !== null &&
    mapping.description !== null &&
    (mapping.amount !== null || mapping.credit !== null || mapping.debit !== null)

  const goToPreview = () => {
    if (!parsed) return
    setRows(mapRows(parsed.rows, mapping))
    setAutoMapped(false)
    setStep('preview')
  }

  const handleImport = async () => {
    const valid = rows.filter(r => r.valid)
    if (valid.length === 0) return
    setImporting(true)
    try {
      const now = new Date().toISOString()
      await db.transactions.bulkAdd(
        valid.map(r => ({
          type: r.type,
          amount: r.amount,
          currency,
          date: r.date,
          description: r.description,
          notes: r.notes,
          tags: [],
          isRecurring: false as const,
          createdAt: now,
          updatedAt: now,
        }))
      )
      toast.success(`Imported ${valid.length} transaction${valid.length !== 1 ? 's' : ''}`)
      handleClose()
    } catch (e) {
      toast.error('Import failed: ' + (e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setStep('upload')
    setParsed(null)
    setError(null)
    setRows([])
    setLoading(false)
    onClose()
  }

  const validCount   = rows.filter(r => r.valid).length
  const invalidCount = rows.filter(r => !r.valid).length

  const stepIndex = { upload: 0, map: 1, preview: 2 }

  return (
    <Modal open={open} onClose={handleClose} title="Import Bank Transactions" size="lg">

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-5 text-xs">
        {(['Upload', 'Map Columns', 'Preview'] as const).map((label, i) => {
          const current = stepIndex[step]
          const done = current > i
          const active = current === i
          return (
            <div key={label} className="flex items-center gap-2">
              <span className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0',
                done   ? 'bg-emerald-500 text-white' :
                active ? 'bg-[var(--color-accent)] text-white' :
                         'bg-[var(--color-surface2)] text-[var(--color-text-muted)]'
              )}>{done ? '✓' : i + 1}</span>
              <span className={active ? 'font-semibold text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}>{label}</span>
              {i < 2 && <ChevronRight size={12} className="text-[var(--color-text-muted)]" />}
            </div>
          )
        })}
      </div>

      {/* ── STEP 1: Upload ── */}
      {step === 'upload' && (
        <div>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
              isDragging
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/60'
            )}
          >
            {loading
              ? <p className="text-[var(--color-text-muted)] text-sm">Parsing file…</p>
              : <>
                  <Upload size={28} className="mx-auto mb-3 text-[var(--color-text-muted)]" />
                  <p className="font-semibold text-[var(--color-text)]">Drop your bank export here</p>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">or click to browse</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-3 opacity-60">Supports .csv · .xls · .xlsx</p>
                </>
            }
            <input ref={fileInputRef} type="file" accept=".csv,.xls,.xlsx,.tsv" className="hidden" onChange={onFileInput} />
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-500 flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </p>
          )}

          <div className="mt-4 rounded-lg bg-[var(--color-surface2)] p-3 text-xs text-[var(--color-text-muted)]">
            <p className="font-semibold text-[var(--color-text)] mb-1.5">How to export from your bank:</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li><strong>Hapoalim:</strong> Account Transactions → Export to Excel</li>
              <li><strong>Leumi:</strong> Account Activity → Export → Excel/CSV</li>
              <li><strong>Discount:</strong> Account Details → Download Transactions</li>
              <li><strong>Mizrahi:</strong> Account Movements → Export</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── STEP 2: Map Columns ── */}
      {step === 'map' && parsed && (
        <div>
          {bankName && (
            <div className="flex items-center gap-2 mb-4 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2">
              <Check size={14} className="shrink-0" />
              <span>Detected: <strong>{bankName}</strong> — columns pre-filled below</span>
            </div>
          )}

          {parsed.skippedRows > 0 && (
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              ℹ️ Skipped {parsed.skippedRows} intro row{parsed.skippedRows !== 1 ? 's' : ''} above the transaction table.
            </p>
          )}

          {/* Raw data preview */}
          <p className="text-xs text-[var(--color-text-muted)] mb-1.5 font-medium">File preview (first 3 rows):</p>
          <div className="mb-4 overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="text-xs w-full">
              <thead>
                <tr className="bg-[var(--color-surface2)]">
                  {parsed.headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-medium text-[var(--color-text-muted)] whitespace-nowrap border-b border-[var(--color-border)]">
                      {h || `Col ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 3).map((row, ri) => (
                  <tr key={ri} className="border-b border-[var(--color-border)] last:border-0">
                    {parsed.headers.map((_, ci) => (
                      <td key={ci} className="px-3 py-1.5 text-[var(--color-text)] whitespace-nowrap max-w-[140px] truncate">
                        {row[ci] || ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Column role selectors */}
          <p className="text-xs text-[var(--color-text-muted)] mb-2 font-medium">Map each column to a field:</p>
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {COLUMN_ROLES.map(({ key, label, hint }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-[var(--color-text)] mb-1">
                  {label}
                  <span className="ml-1 text-[var(--color-text-muted)] font-normal">— {hint}</span>
                </label>
                <Select
                  value={mapping[key] !== null ? String(mapping[key]) : ''}
                  onChange={e => setCol(key, e.target.value)}
                >
                  <option value="">— skip —</option>
                  {parsed.headers.map((h, i) => (
                    <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                  ))}
                </Select>
              </div>
            ))}
          </div>

          {/* Currency */}
          <div className="mb-4 w-40">
            <label className="block text-xs font-medium text-[var(--color-text)] mb-1">Transaction currency</label>
            <Select value={currency} onChange={e => setCurrency(e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>

          {!canProceedToPreview && (
            <p className="text-xs text-amber-500 mb-3">Please map at least: Date, Description, and one of Amount / Credit / Debit.</p>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('upload')}>Back</Button>
            <Button onClick={goToPreview} disabled={!canProceedToPreview}>Preview →</Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Preview & Confirm ── */}
      {step === 'preview' && (
        <div>
          {autoMapped && (
            <div className="flex items-center gap-2 mb-3 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2">
              <Check size={14} className="shrink-0" />
              <span>
                {bankName ? <>Recognized <strong>{bankName}</strong> format — </> : ''}
                columns were matched automatically. Check the list below, then import.
              </span>
            </div>
          )}

          <div className="flex items-center gap-4 mb-3 text-sm">
            <span className="font-semibold text-[var(--color-text)]">{rows.length} rows parsed</span>
            <span className="text-emerald-500">{validCount} ready to import</span>
            {invalidCount > 0 && (
              <span className="text-red-400">{invalidCount} skipped</span>
            )}
          </div>

          <div className="overflow-y-auto max-h-72 rounded-lg border border-[var(--color-border)] mb-4">
            <table className="text-xs w-full">
              <thead className="sticky top-0 bg-[var(--color-surface2)] z-10">
                <tr>
                  {['Date', 'Description', 'Amount', 'Type'].map(h => (
                    <th key={h} className={cn('px-3 py-2 border-b border-[var(--color-border)] text-[var(--color-text-muted)] font-semibold text-left', h === 'Amount' && 'text-right')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={cn(
                    'border-b border-[var(--color-border)] last:border-0',
                    !r.valid && 'opacity-40 bg-red-50 dark:bg-red-900/10'
                  )}>
                    <td className="px-3 py-1.5 whitespace-nowrap text-[var(--color-text-muted)]">{r.date || '—'}</td>
                    <td className="px-3 py-1.5 text-[var(--color-text)] max-w-[200px] truncate">
                      {r.valid ? r.description : <span className="text-red-400 italic">{r.error}</span>}
                    </td>
                    <td className={cn(
                      'px-3 py-1.5 text-right font-medium whitespace-nowrap',
                      r.valid ? (r.type === 'income' ? 'text-emerald-500' : 'text-red-500') : 'text-[var(--color-text-muted)]'
                    )}>
                      {r.valid ? `${r.type === 'income' ? '+' : '-'}${r.amount.toFixed(2)} ${currency}` : '—'}
                    </td>
                    <td className="px-3 py-1.5">
                      {r.valid && (
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] font-semibold',
                          r.type === 'income'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        )}>
                          {r.type}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {validCount === 0 && (
            <p className="text-sm text-red-500 mb-3 flex items-center gap-2">
              <AlertCircle size={14} /> No valid rows found. Go back and check your column mapping.
            </p>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('map')}>Back</Button>
            <Button
              onClick={handleImport}
              disabled={importing || validCount === 0}
            >
              {importing ? 'Importing…' : `Import ${validCount} Transaction${validCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
