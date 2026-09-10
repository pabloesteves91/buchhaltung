import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BellRing,
  BookText,
  FileText,
  LayoutDashboard,
  ListTree,
  Lock,
  Notebook,
  Package,
  Settings,
  ShoppingBag,
  Users,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useContacts, contactName } from '@/hooks/useContacts'
import { useDocuments } from '@/hooks/useDocuments'

const NAV = [
  { to: '/', label: 'Übersicht', icon: LayoutDashboard },
  { to: '/journal', label: 'Buchungen', icon: BookText },
  { to: '/konten', label: 'Kontenplan', icon: ListTree },
  { to: '/kunden', label: 'Kunden', icon: Users },
  { to: '/dokumente', label: 'Offerten & Rechnungen', icon: FileText },
  { to: '/artikel', label: 'Artikel', icon: Package },
  { to: '/mahnwesen', label: 'Mahnwesen', icon: BellRing },
  { to: '/shopify', label: 'Shopify', icon: ShoppingBag },
  { to: '/auswertungen', label: 'Auswertungen', icon: BarChart3 },
  { to: '/abschluss', label: 'Jahresabschluss', icon: Lock },
  { to: '/notizen', label: 'Notizen', icon: Notebook },
  { to: '/einstellungen', label: 'Einstellungen', icon: Settings },
]

/**
 * ⌘K / Ctrl+K global palette: jump to any section, customer, or document.
 * Also opened via the button in the AppShell header.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate()
  const { data: contacts = [] } = useContacts()
  const { data: documents = [] } = useDocuments()

  const go = (to: string) => {
    onOpenChange(false)
    navigate(to)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Suche"
      description="Zu einem Bereich, Kunden oder Dokument springen"
    >
      <CommandInput placeholder="Suchen … (Bereich, Kunde, Dokument)" />
      <CommandList>
        <CommandEmpty>Nichts gefunden.</CommandEmpty>
        <CommandGroup heading="Bereiche">
          {NAV.map((item) => (
            <CommandItem key={item.to} value={`bereich ${item.label}`} onSelect={() => go(item.to)}>
              <item.icon className="size-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {contacts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Kunden">
              {contacts.slice(0, 50).map((c) => (
                <CommandItem
                  key={c.id}
                  value={`kunde ${contactName(c)} ${c.email ?? ''}`}
                  onSelect={() => go(`/kunden/${c.id}`)}
                >
                  <Users className="size-4" />
                  {contactName(c)}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {documents.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Dokumente">
              {documents.slice(0, 50).map((d) => (
                <CommandItem
                  key={d.id}
                  value={`dokument ${d.number} ${d.recipientSnapshot?.name ?? ''}`}
                  onSelect={() => go(`/dokumente/${d.id}`)}
                >
                  <FileText className="size-4" />
                  {d.number}
                  <span className="text-muted-foreground">
                    {d.recipientSnapshot?.name ? ` · ${d.recipientSnapshot.name}` : ''}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}

/** Hook up the ⌘K / Ctrl+K shortcut. Returns [open, setOpen]. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return [open, setOpen] as const
}
