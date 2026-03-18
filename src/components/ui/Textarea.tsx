import { TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-[var(--color-text-muted)]">{label}</label>
      )}
      <textarea
        ref={ref}
        rows={3}
        className={cn(
          'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]',
          'px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent',
          'resize-none transition-colors',
          className
        )}
        {...props}
      />
    </div>
  )
)
Textarea.displayName = 'Textarea'
