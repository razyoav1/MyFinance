import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, TrendingUp, Building2, Target } from 'lucide-react'
import { cn } from '@/lib/cn'

const NAV_ITEMS = [
  { to: '/dashboard',    label: 'Home',     icon: LayoutDashboard },
  { to: '/transactions', label: 'Txns',     icon: ArrowLeftRight },
  { to: '/investments',  label: 'Invest',   icon: TrendingUp },
  { to: '/mortgage',     label: 'Mortgage', icon: Building2 },
  { to: '/goals',        label: 'Goals',    icon: Target },
]

export function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors',
                isActive
                  ? 'text-[var(--color-primary)]'
                  : 'text-[var(--color-text-muted)]'
              )
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
