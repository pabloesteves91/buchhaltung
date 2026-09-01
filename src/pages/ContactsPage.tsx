import { useMemo, useState } from 'react'
import { Mail, Phone, Plus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import {
  contactName,
  useContacts,
  useCreateContact,
  useDeleteContact,
  useUpdateContact,
} from '@/hooks/useContacts'
import { useSettings } from '@/hooks/useSettings'
import type { Contact, ContactLanguage, ContactType } from '@/lib/types'

type FormState = Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'sortName'>

const emptyForm = (paymentTermDays: number): FormState => ({
  type: 'kunde',
  company: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: { line1: '', line2: '', zip: '', city: '', country: 'CH' },
  language: 'de',
  paymentTermDays,
  vatNumber: '',
  tags: [],
  note: '',
})

const TYPE_LABEL: Record<ContactType, string> = {
  kunde: 'Kunde',
  lieferant: 'Lieferant',
  beides: 'Kunde + Lieferant',
}

export function ContactsPage() {
  const { data: settings } = useSettings()
  const { data: contacts, isLoading } = useContacts()
  const createContact = useCreateContact()
  const updateContact = useUpdateContact()
  const deleteContact = useDeleteContact()

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Contact | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm(30))

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return contacts ?? []
    return (contacts ?? []).filter((c) =>
      [contactName(c), c.email, c.address.city, ...c.tags].join(' ').toLowerCase().includes(q),
    )
  }, [contacts, search])

  function openNew() {
    setEditing(null)
    setForm(emptyForm(settings?.invoice.defaultPaymentTermDays ?? 30))
    setShowForm(true)
  }

  function openEdit(c: Contact) {
    setEditing(c)
    const { id, createdAt, updatedAt, sortName, ...rest } = c
    void id
    void createdAt
    void updatedAt
    void sortName
    setForm({ ...emptyForm(30), ...rest })
    setShowForm(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const sortName = contactName(form).toLowerCase()
    const payload = { ...form, sortName }
    if (editing) {
      await updateContact.mutateAsync({ id: editing.id, ...payload })
    } else {
      await createContact.mutateAsync(payload)
    }
    setShowForm(false)
  }

  return (
    <>
      <PageHeader
        title="Kunden"
        subtitle="Kunden und Lieferanten mit Adressen und Notizen."
        actions={
          <Button onClick={openNew}>
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
          description="Lege deinen ersten Kunden an – du kannst ihn danach direkt auf einer Offerte oder Rechnung verwenden."
          action={<Button onClick={openNew}>Kontakt anlegen</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="cursor-pointer hover:border-brand-300" >
              <button className="w-full text-left" onClick={() => openEdit(c)}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-800">{contactName(c)}</p>
                  <Badge tone={c.type === 'lieferant' ? 'amber' : 'blue'}>
                    {TYPE_LABEL[c.type]}
                  </Badge>
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
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}
        wide
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Typ">
              <Select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as ContactType })}
              >
                {Object.entries(TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sprache">
              <Select
                value={form.language}
                onChange={(e) =>
                  setForm({ ...form, language: e.target.value as ContactLanguage })
                }
              >
                <option value="de">Deutsch</option>
                <option value="fr">Französisch</option>
                <option value="it">Italienisch</option>
                <option value="en">Englisch</option>
              </Select>
            </Field>
            <Field label="Firma">
              <Input
                value={form.company ?? ''}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vorname">
                <Input
                  value={form.firstName ?? ''}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </Field>
              <Field label="Nachname">
                <Input
                  value={form.lastName ?? ''}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </Field>
            </div>
            <Field label="E-Mail">
              <Input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Telefon">
              <Input
                value={form.phone ?? ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Strasse / Nr.">
              <Input
                value={form.address.line1 ?? ''}
                onChange={(e) =>
                  setForm({ ...form, address: { ...form.address, line1: e.target.value } })
                }
              />
            </Field>
            <Field label="Adresszusatz">
              <Input
                value={form.address.line2 ?? ''}
                onChange={(e) =>
                  setForm({ ...form, address: { ...form.address, line2: e.target.value } })
                }
              />
            </Field>
            <div className="grid grid-cols-[6rem_1fr] gap-3">
              <Field label="PLZ">
                <Input
                  value={form.address.zip ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, address: { ...form.address, zip: e.target.value } })
                  }
                />
              </Field>
              <Field label="Ort">
                <Input
                  value={form.address.city ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, address: { ...form.address, city: e.target.value } })
                  }
                />
              </Field>
            </div>
            <div className="grid grid-cols-[6rem_1fr] gap-3">
              <Field label="Land">
                <Input
                  value={form.address.country}
                  onChange={(e) =>
                    setForm({ ...form, address: { ...form.address, country: e.target.value } })
                  }
                />
              </Field>
              <Field label="Zahlungsfrist (Tage)">
                <Input
                  type="number"
                  value={form.paymentTermDays}
                  onChange={(e) =>
                    setForm({ ...form, paymentTermDays: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
            <Field label="Tags (Komma-getrennt)">
              <Input
                value={form.tags.join(', ')}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tags: e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Field>
          </div>
          <Field label="Notiz">
            <Textarea
              rows={2}
              value={form.note ?? ''}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button type="submit">Speichern</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Abbrechen
              </Button>
            </div>
            {editing && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  if (confirm(`Kontakt „${contactName(editing)}“ löschen?`)) {
                    deleteContact.mutate(editing.id)
                    setShowForm(false)
                  }
                }}
              >
                Löschen
              </Button>
            )}
          </div>
        </form>
      </Modal>
    </>
  )
}
