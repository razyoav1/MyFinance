import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

const variants = {
  default: 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]',
  outline: 'border border-[var(--color-border)] bg-transparent hover:bg-[var(--color-surface)] text-[var(--color-text)]',
  ghost: 'bg-transparent hover:bg-[var(--color-surface)] text-[var(--color-text)]',
  danger: 'bg-red-500 text-white hover:bg-red-600',
  success: 'bg-emerald-500 text-white hover:bg-emerald-600',
}

const sizes = {
  sm: 'h-7 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-5 text-sm',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors',
        'disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
)
Button.displayName = 'Button'
