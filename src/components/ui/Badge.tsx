import { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'income' | 'expense' | 'neutral' | 'custom'
  color?: string
}

export function Badge({ className, variant = 'neutral', color, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        variant === 'income' && 'bg-emerald-500/15 text-emerald-500',
        variant === 'expense' && 'bg-red-500/15 text-red-500',
        variant === 'neutral' && 'bg-[var(--color-surface2)] text-[var(--color-text-muted)]',
        className
      )}
      style={color ? { backgroundColor: color + '22', color } : undefined}
      {...props}
    >
      {children}
    </span>
  )
}
