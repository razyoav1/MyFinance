import { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      {icon && <div className="text-5xl mb-4">{icon}</div>}
      <h3 className="font-semibold text-[var(--color-text)] mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--color-text-muted)] max-w-xs mb-4">{description}</p>
      )}
      {action}
    </div>
  )
}
