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

export default function App() {
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
              <Route path="/investments"  element={<Investments />} />
              <Route path="/mortgage"     element={<Mortgage />} />
              <Route path="/goals"        element={<Goals />} />
              <Route path="/settings"     element={<SettingsPage />} />
            </Routes>
          </main>
          <MobileNav />
        </div>
      </div>
    </HashRouter>
  )
}
