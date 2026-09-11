import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  BellRing,
  BookText,
  FileText,
  LayoutDashboard,
  ListTree,
  Lock,
  LogOut,
  Menu,
  Notebook,
  Package,
  Search,
  Settings,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useSettings } from '@/hooks/useSettings'
import { cn } from '@/lib/cn'
import { CommandPalette, useCommandPalette } from '@/components/CommandPalette'

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean }

const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Erfassen',
    items: [
      { to: '/', label: 'Übersicht', icon: LayoutDashboard, end: true },
      { to: '/journal', label: 'Buchungen', icon: BookText },
      { to: '/kunden', label: 'Kunden', icon: Users },
      { to: '/dokumente', label: 'Offerten & Rechnungen', icon: FileText },
      { to: '/artikel', label: 'Artikel', icon: Package },
      { to: '/shopify', label: 'Shopify', icon: ShoppingBag },
    ],
  },
  {
    heading: 'Auswerten',
    items: [
      { to: '/konten', label: 'Kontenplan', icon: ListTree },
      { to: '/auswertungen', label: 'Auswertungen', icon: BarChart3 },
      { to: '/mahnwesen', label: 'Mahnwesen', icon: BellRing },
      { to: '/notizen', label: 'Notizen', icon: Notebook },
    ],
  },
  {
    heading: 'Abschluss',
    items: [{ to: '/abschluss', label: 'Jahresabschluss', icon: Lock }],
  },
]

function SidebarContent({
  onNavigate,
  onSearch,
}: {
  onNavigate?: () => void
  onSearch?: () => void
}) {
  const { user, signOut } = useAuth()
  const { data: settings } = useSettings()

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-brand-50 text-brand-700'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    )

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
          <p className="text-lg font-bold tracking-tight text-foreground">
            {settings?.name || 'nipponnites'}
          </p>
        )}
        <p className="text-xs text-muted-foreground">Buchhaltung</p>
      </div>

      {onSearch && (
        <div className="px-3 pb-2">
          <button
            onClick={onSearch}
            className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted active:translate-y-px"
          >
            <Search className="size-4" />
            <span className="flex-1 text-left">Suchen</span>
            <kbd className="rounded border border-border bg-muted px-1.5 text-[10px] font-medium">
              ⌘K
            </kbd>
          </button>
        </div>
      )}

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.heading} className="space-y-0.5">
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
              {group.heading}
            </p>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={linkClass}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <NavLink to="/einstellungen" onClick={onNavigate} className={linkClass}>
          <Settings className="size-4 shrink-0" />
          Einstellungen
        </NavLink>
        <p className="truncate px-3 pt-2 pb-1 text-xs text-muted-foreground">{user?.email}</p>
        <button
          onClick={() => void signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
  const [paletteOpen, setPaletteOpen] = useCommandPalette()

  // Close the mobile drawer on route change.
  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Desktop sidebar — fixed height, own scroll; only <main> scrolls with the page. */}
      <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-border bg-card lg:block">
        <SidebarContent onSearch={() => setPaletteOpen(true)} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-64 max-w-[80%] bg-card shadow-xl">
            <button
              className="absolute top-3 right-3 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted"
              onClick={() => setOpen(false)}
              aria-label="Menü schliessen"
            >
              <X className="size-5" />
            </button>
            <SidebarContent
              onNavigate={() => setOpen(false)}
              onSearch={() => {
                setOpen(false)
                setPaletteOpen(true)
              }}
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Menü öffnen"
          >
            <Menu className="size-5" />
          </button>
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="" className="max-h-7 object-contain" />
          ) : (
            <span className="font-semibold text-foreground">{settings?.name || 'nipponnites'}</span>
          )}
          <button
            onClick={() => setPaletteOpen(true)}
            className="ml-auto rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Suchen"
          >
            <Search className="size-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
