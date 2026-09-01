import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { AuthProvider, useAuth } from '@/lib/auth'
import { queryClient } from '@/lib/queryClient'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { JournalPage } from '@/pages/JournalPage'
import { AccountsPage } from '@/pages/AccountsPage'
import {
  ContactsPage,
  DocumentsPage,
  NotesPage,
  ReportsPage,
  ShopifyPage,
} from '@/pages/stubs'
import { SettingsPage } from '@/pages/SettingsPage'

function Protected() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        Laden …
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <AppShell />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<Protected />}>
              <Route index element={<DashboardPage />} />
              <Route path="journal" element={<JournalPage />} />
              <Route path="konten" element={<AccountsPage />} />
              <Route path="kunden" element={<ContactsPage />} />
              <Route path="dokumente" element={<DocumentsPage />} />
              <Route path="shopify" element={<ShopifyPage />} />
              <Route path="auswertungen" element={<ReportsPage />} />
              <Route path="notizen" element={<NotesPage />} />
              <Route path="einstellungen" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
