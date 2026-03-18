import { cn } from '@/lib/cn'

interface ProgressBarProps {
  value: number // 0-100
  color?: string
  className?: string
  size?: 'sm' | 'md'
}

export function ProgressBar({ value, color, className, size = 'md' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      className={cn(
        'w-full rounded-full bg-[var(--color-surface2)]',
        size === 'sm' ? 'h-1.5' : 'h-2.5',
        className
      )}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${clamped}%`,
          backgroundColor: color ?? 'var(--color-primary)',
        }}
      />
    </div>
  )
}
