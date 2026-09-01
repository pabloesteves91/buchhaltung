import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  BookText,
  FileText,
  LayoutDashboard,
  ListTree,
  LogOut,
  Menu,
  Notebook,
  Settings,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useSettings } from '@/hooks/useSettings'
import { cn } from '@/lib/cn'

const nav = [
  { to: '/', label: 'Übersicht', icon: LayoutDashboard, end: true },
  { to: '/journal', label: 'Buchungen', icon: BookText },
  { to: '/konten', label: 'Kontenplan', icon: ListTree },
  { to: '/kunden', label: 'Kunden', icon: Users },
  { to: '/dokumente', label: 'Offerten & Rechnungen', icon: FileText },
  { to: '/shopify', label: 'Shopify', icon: ShoppingBag },
  { to: '/auswertungen', label: 'Auswertungen', icon: BarChart3 },
  { to: '/notizen', label: 'Notizen', icon: Notebook },
  { to: '/einstellungen', label: 'Einstellungen', icon: Settings },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth()
  const { data: settings } = useSettings()

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        {settings?.logoUrl ? (
          <img
            src={settings.logoUrl}
            alt={settings.name || 'Logo'}
            className="mb-1 max-h-12 max-w-[9rem] object-contain"
          />
        ) : (
          <p className="text-lg font-bold tracking-tight text-slate-900">
            {settings?.name || 'nipponnites'}
          </p>
        )}
        <p className="text-xs text-slate-400">Buchhaltung</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
              )
            }
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <p className="truncate px-3 pb-2 text-xs text-slate-400">{user?.email}</p>
        <button
          onClick={() => void signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          <LogOut className="size-4" />
          Abmelden
        </button>
      </div>
    </div>
  )
}

export function AppShell() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { data: settings } = useSettings()

  // Close the mobile drawer on route change.
  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-64 max-w-[80%] bg-white shadow-xl">
            <button
              className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              onClick={() => setOpen(false)}
              aria-label="Menü schliessen"
            >
              <X className="size-5" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"
            aria-label="Menü öffnen"
          >
            <Menu className="size-5" />
          </button>
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="" className="max-h-7 object-contain" />
          ) : (
            <span className="font-semibold text-slate-900">{settings?.name || 'nipponnites'}</span>
          )}
        </header>

        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
