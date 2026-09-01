import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Phone, Plus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, EmptyState, Input } from '@/components/ui'
import { ContactFormModal, TYPE_LABEL } from '@/components/ContactFormModal'
import { contactName, useContacts } from '@/hooks/useContacts'

export function ContactsPage() {
  const navigate = useNavigate()
  const { data: contacts, isLoading } = useContacts()
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return contacts ?? []
    return (contacts ?? []).filter((c) =>
      [contactName(c), c.email, c.address.city, ...c.tags].join(' ').toLowerCase().includes(q),
    )
  }, [contacts, search])

  return (
    <>
      <PageHeader
        title="Kunden"
        subtitle="Kunden und Lieferanten – anklicken für Historie und Umsatz."
        actions={
          <Button onClick={() => setShowNew(true)}>
            <Plus className="size-4" /> Kontakt
          </Button>
        }
      />

      {(contacts?.length ?? 0) > 0 && (
        <div className="mb-4">
          <Input
            placeholder="Suchen (Name, Ort, E-Mail, Tag) …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400">Laden …</p>
      ) : (contacts?.length ?? 0) === 0 ? (
        <EmptyState
          title="Noch keine Kontakte"
          description="Lege deinen ersten Kunden an oder importiere sie unter „Shopify“."
          action={<Button onClick={() => setShowNew(true)}>Kontakt anlegen</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/kunden/${c.id}`)}
              className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand-300"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-800">{contactName(c)}</p>
                <Badge tone={c.type === 'lieferant' ? 'amber' : 'blue'}>{TYPE_LABEL[c.type]}</Badge>
              </div>
              {(c.address.zip || c.address.city) && (
                <p className="mt-1 text-sm text-slate-500">
                  {c.address.line1} · {c.address.zip} {c.address.city}
                </p>
              )}
              <div className="mt-2 space-y-1 text-sm text-slate-500">
                {c.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="size-3.5" /> {c.email}
                  </p>
                )}
                {c.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="size-3.5" /> {c.phone}
                  </p>
                )}
              </div>
              {c.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.tags.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {showNew && (
        <ContactFormModal key="new" open onClose={() => setShowNew(false)} contact={null} />
      )}
    </>
  )
}
