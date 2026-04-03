import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { MobileNav } from '@/components/layout/MobileNav'
import { Dashboard } from '@/pages/Dashboard'
import { Transactions } from '@/pages/Transactions'
import { Investments } from '@/pages/Investments'
import { Mortgage } from '@/pages/Mortgage'
import { Goals } from '@/pages/Goals'
import { SettingsPage } from '@/pages/Settings'
import { Wealth } from '@/pages/Wealth'
import { ToastContainer } from '@/components/ui/Toast'
import { RefreshProvider } from '@/contexts/RefreshContext'
import { useAuth } from '@/hooks/useAuth'
import Auth from '@/pages/Auth'
import ResetPassword from '@/pages/ResetPassword'

function AppContent() {
  const { user, loading, isPasswordRecovery, setIsPasswordRecovery } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[var(--color-text-muted)]">Loading...</span>
        </div>
      </div>
    )
  }

  if (isPasswordRecovery) {
    return <ResetPassword onDone={() => setIsPasswordRecovery(false)} />
  }

  if (!user) {
    return <Auth />
  }

  return (
    <HashRouter>
      <div className="flex h-screen bg-[var(--color-bg)] overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"    element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/wealth"        element={<Wealth />} />
              <Route path="/investments"  element={<Investments />} />
              <Route path="/mortgage"     element={<Mortgage />} />
              <Route path="/goals"        element={<Goals />} />
              <Route path="/settings"     element={<SettingsPage />} />
            </Routes>
          </main>
          <MobileNav />
        </div>
      </div>
      <ToastContainer />
    </HashRouter>
  )
}

export default function App() {
  return (
    <RefreshProvider>
      <AppContent />
    </RefreshProvider>
  )
}
