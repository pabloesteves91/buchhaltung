import { NavLink, Outlet } from 'react-router-dom'
import {
  BookText,
  FileText,
  LayoutDashboard,
  ListTree,
  LogOut,
  Notebook,
  Settings,
  ShoppingBag,
  Users,
  BarChart3,
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

export function AppShell() {
  const { user, signOut } = useAuth()
  const { data: settings } = useSettings()

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
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
        <nav className="flex-1 space-y-0.5 px-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100',
                )
              }
            >
              <item.icon className="size-4" />
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
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
