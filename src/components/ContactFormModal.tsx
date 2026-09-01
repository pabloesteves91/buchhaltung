import { useState } from 'react'
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import {
  contactName,
  useCreateContact,
  useDeleteContact,
  useUpdateContact,
} from '@/hooks/useContacts'
import { useSettings } from '@/hooks/useSettings'
import type { Contact, ContactLanguage, ContactType } from '@/lib/types'

type FormState = Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'sortName'>

export const TYPE_LABEL: Record<ContactType, string> = {
  kunde: 'Kunde',
  lieferant: 'Lieferant',
  beides: 'Kunde + Lieferant',
}

function emptyForm(paymentTermDays: number): FormState {
  return {
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
  }
}

export function ContactFormModal({
  open,
  onClose,
  contact,
  onDeleted,
}: {
  open: boolean
  onClose: () => void
  /** null → create mode. */
  contact: Contact | null
  onDeleted?: () => void
}) {
  const { data: settings } = useSettings()
  const createContact = useCreateContact()
  const updateContact = useUpdateContact()
  const deleteContact = useDeleteContact()

  const [form, setForm] = useState<FormState>(() => {
    if (contact) {
      const { id, createdAt, updatedAt, sortName, ...rest } = contact
      void id
      void createdAt
      void updatedAt
      void sortName
      return { ...emptyForm(30), ...rest }
    }
    return emptyForm(settings?.invoice.defaultPaymentTermDays ?? 30)
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { ...form, sortName: contactName(form).toLowerCase() }
    if (contact) {
      await updateContact.mutateAsync({ id: contact.id, ...payload })
    } else {
      await createContact.mutateAsync(payload)
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={contact ? 'Kontakt bearbeiten' : 'Neuer Kontakt'} wide>
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
              onChange={(e) => setForm({ ...form, language: e.target.value as ContactLanguage })}
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
              onChange={(e) => setForm({ ...form, address: { ...form.address, line1: e.target.value } })}
            />
          </Field>
          <Field label="Adresszusatz">
            <Input
              value={form.address.line2 ?? ''}
              onChange={(e) => setForm({ ...form, address: { ...form.address, line2: e.target.value } })}
            />
          </Field>
          <div className="grid grid-cols-[6rem_1fr] gap-3">
            <Field label="PLZ">
              <Input
                value={form.address.zip ?? ''}
                onChange={(e) => setForm({ ...form, address: { ...form.address, zip: e.target.value } })}
              />
            </Field>
            <Field label="Ort">
              <Input
                value={form.address.city ?? ''}
                onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })}
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
                onChange={(e) => setForm({ ...form, paymentTermDays: Number(e.target.value) })}
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
            <Button type="button" variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
          </div>
          {contact && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                if (confirm(`Kontakt „${contactName(contact)}“ löschen?`)) {
                  deleteContact.mutate(contact.id)
                  onClose()
                  onDeleted?.()
                }
              }}
            >
              Löschen
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}
