import { lazy, Suspense } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { AuthProvider, useAuth } from '@/lib/auth'
import { queryClient } from '@/lib/queryClient'
import { LoginPage } from '@/pages/LoginPage'

const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const JournalPage = lazy(() => import('@/pages/JournalPage').then((m) => ({ default: m.JournalPage })))
const AccountsPage = lazy(() => import('@/pages/AccountsPage').then((m) => ({ default: m.AccountsPage })))
const ContactsPage = lazy(() => import('@/pages/ContactsPage').then((m) => ({ default: m.ContactsPage })))
const DocumentsPage = lazy(() => import('@/pages/DocumentsPage').then((m) => ({ default: m.DocumentsPage })))
const DocumentEditorPage = lazy(() =>
  import('@/pages/DocumentEditorPage').then((m) => ({ default: m.DocumentEditorPage })),
)
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const ShopifyPage = lazy(() => import('@/pages/ShopifyPage').then((m) => ({ default: m.ShopifyPage })))
const ReportsPage = lazy(() => import('@/pages/stubs').then((m) => ({ default: m.ReportsPage })))
const NotesPage = lazy(() => import('@/pages/stubs').then((m) => ({ default: m.NotesPage })))

function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-400">
      Laden …
    </div>
  )
}

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
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<Protected />}>
                <Route index element={<DashboardPage />} />
                <Route path="journal" element={<JournalPage />} />
                <Route path="konten" element={<AccountsPage />} />
                <Route path="kunden" element={<ContactsPage />} />
                <Route path="dokumente" element={<DocumentsPage />} />
                <Route path="dokumente/neu" element={<DocumentEditorPage />} />
                <Route path="dokumente/:id" element={<DocumentEditorPage />} />
                <Route path="shopify" element={<ShopifyPage />} />
                <Route path="auswertungen" element={<ReportsPage />} />
                <Route path="notizen" element={<NotesPage />} />
                <Route path="einstellungen" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
