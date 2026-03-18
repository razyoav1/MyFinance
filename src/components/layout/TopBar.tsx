import { Sun, Moon, DollarSign } from 'lucide-react'
import { useThemeStore } from '@/store/useThemeStore'
import { useCurrencyStore } from '@/store/useCurrencyStore'
import { cn } from '@/lib/cn'

interface TopBarProps {
  title?: string
}

export function TopBar({ title }: TopBarProps) {
  const { theme, toggle } = useThemeStore()
  const { baseCurrency } = useCurrencyStore()

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] sticky top-0 z-10">
      {/* Mobile logo */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="w-7 h-7 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
          <DollarSign size={14} className="text-white" />
        </div>
        <span className="font-bold text-sm text-[var(--color-text)]">MyFinance</span>
      </div>
      {title && (
        <span className="hidden md:block font-semibold text-[var(--color-text)]">{title}</span>
      )}

      <div className="flex items-center gap-2 ml-auto">
        {/* Currency badge */}
        <span className="text-xs font-medium text-[var(--color-text-muted)] border border-[var(--color-border)] rounded px-2 py-1">
          {baseCurrency}
        </span>
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
            'hover:bg-[var(--color-surface2)] text-[var(--color-text-muted)]'
          )}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  )
}
