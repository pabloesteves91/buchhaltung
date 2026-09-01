import { lazy, Suspense, type ComponentType } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { AuthProvider, useAuth } from '@/lib/auth'
import { queryClient } from '@/lib/queryClient'
import { LoginPage } from '@/pages/LoginPage'

/**
 * lazy() import that self-heals after a deploy: if the old chunk hash is gone
 * (stale index.html still cached), reload the page once to pick up the new build.
 */
function lazyPage<T extends Record<string, ComponentType<object>>>(
  factory: () => Promise<T>,
  name: keyof T,
) {
  return lazy(() =>
    factory()
      .then((m) => ({ default: m[name] }))
      .catch((err) => {
        const KEY = 'chunk-reload-at'
        const last = Number(sessionStorage.getItem(KEY) ?? 0)
        if (Date.now() - last > 10_000) {
          sessionStorage.setItem(KEY, String(Date.now()))
          window.location.reload()
        }
        throw err
      }),
  )
}

const DashboardPage = lazyPage(() => import('@/pages/DashboardPage'), 'DashboardPage')
const JournalPage = lazyPage(() => import('@/pages/JournalPage'), 'JournalPage')
const AccountsPage = lazyPage(() => import('@/pages/AccountsPage'), 'AccountsPage')
const ContactsPage = lazyPage(() => import('@/pages/ContactsPage'), 'ContactsPage')
const ContactDetailPage = lazyPage(() => import('@/pages/ContactDetailPage'), 'ContactDetailPage')
const DocumentsPage = lazyPage(() => import('@/pages/DocumentsPage'), 'DocumentsPage')
const DocumentEditorPage = lazyPage(() => import('@/pages/DocumentEditorPage'), 'DocumentEditorPage')
const SettingsPage = lazyPage(() => import('@/pages/SettingsPage'), 'SettingsPage')
const ShopifyPage = lazyPage(() => import('@/pages/ShopifyPage'), 'ShopifyPage')
const ShopifyOrderPage = lazyPage(() => import('@/pages/ShopifyOrderPage'), 'ShopifyOrderPage')
const ReportsPage = lazyPage(() => import('@/pages/ReportsPage'), 'ReportsPage')
const ClosingPage = lazyPage(() => import('@/pages/ClosingPage'), 'ClosingPage')
const NotesPage = lazyPage(() => import('@/pages/NotesPage'), 'NotesPage')

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
                <Route path="kunden/:id" element={<ContactDetailPage />} />
                <Route path="dokumente" element={<DocumentsPage />} />
                <Route path="dokumente/neu" element={<DocumentEditorPage />} />
                <Route path="dokumente/:id" element={<DocumentEditorPage />} />
                <Route path="shopify" element={<ShopifyPage />} />
                <Route path="shopify/bestellung/:orderId" element={<ShopifyOrderPage />} />
                <Route path="auswertungen" element={<ReportsPage />} />
                <Route path="abschluss" element={<ClosingPage />} />
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
