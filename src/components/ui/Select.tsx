import { SelectHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, children, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-[var(--color-text-muted)]">{label}</label>
      )}
      <select
        ref={ref}
        className={cn(
          'h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]',
          'px-3 text-sm text-[var(--color-text)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent',
          'transition-colors cursor-pointer',
          error && 'border-red-500',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
)
Select.displayName = 'Select'
