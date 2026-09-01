import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, Pencil, Phone } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, TableWrap } from '@/components/ui'
import { ContactFormModal, TYPE_LABEL } from '@/components/ContactFormModal'
import { contactName, useContacts } from '@/hooks/useContacts'
import { useDocuments, DOCUMENT_TYPE_LABEL } from '@/hooks/useDocuments'
import { useShopifyOrders } from '@/hooks/useShopify'
import { useTransactions } from '@/hooks/useTransactions'
import { formatCHF, formatDate } from '@/lib/format'

export function ContactDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: contacts } = useContacts()
  const { data: allDocs } = useDocuments()
  const { data: allOrders } = useShopifyOrders()
  const { data: allTx } = useTransactions()
  const [edit, setEdit] = useState(false)

  const contact = (contacts ?? []).find((c) => c.id === id)

  const orders = useMemo(() => {
    if (!contact) return []
    const email = contact.email?.toLowerCase()
    return (allOrders ?? []).filter(
      (o) =>
        o.contactId === contact.id ||
        (o.shopifyCustomerId && o.shopifyCustomerId === contact.shopifyCustomerId) ||
        (email && o.customerEmail?.toLowerCase() === email),
    )
  }, [allOrders, contact])

  const docs = useMemo(
    () => (allDocs ?? []).filter((d) => d.contactId === contact?.id),
    [allDocs, contact],
  )

  const linkedTx = useMemo(() => {
    const orderIds = new Set(orders.map((o) => o.orderId))
    const docIds = new Set(docs.map((d) => d.id))
    return (allTx ?? []).filter(
      (t) =>
        (t.shopifyOrderId && orderIds.has(t.shopifyOrderId)) ||
        (t.linkedDocumentId && docIds.has(t.linkedDocumentId)),
    )
  }, [allTx, orders, docs])

  const revenue = useMemo(() => {
    const fromOrders = orders.reduce((s, o) => s + o.total, 0)
    const fromInvoices = docs
      .filter((d) => d.type === 'rechnung' && d.status !== 'storniert')
      .reduce((s, d) => s + d.total, 0)
    return fromOrders + fromInvoices
  }, [orders, docs])

  if (!contact) {
    return (
      <>
        <PageHeader title="Kunde" />
        <p className="text-sm text-slate-400">Nicht gefunden.</p>
        <Button variant="ghost" className="mt-3" onClick={() => navigate('/kunden')}>
          <ArrowLeft className="size-4" /> Zurück
        </Button>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={contactName(contact)}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate('/kunden')}>
              <ArrowLeft className="size-4" /> Zurück
            </Button>
            <Button variant="secondary" onClick={() => setEdit(true)}>
              <Pencil className="size-4" /> Bearbeiten
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Stammdaten */}
        <div className="space-y-4">
          <Card title="Stammdaten">
            <div className="space-y-1 text-sm text-slate-600">
              <Badge tone={contact.type === 'lieferant' ? 'amber' : 'blue'}>
                {TYPE_LABEL[contact.type]}
              </Badge>
              {contact.company && <p className="mt-2 font-medium text-slate-800">{contact.company}</p>}
              {(contact.firstName || contact.lastName) && (
                <p>
                  {contact.firstName} {contact.lastName}
                </p>
              )}
              <p>{contact.address.line1}</p>
              {contact.address.line2 && <p>{contact.address.line2}</p>}
              <p>
                {contact.address.zip} {contact.address.city}
              </p>
              {contact.address.country && contact.address.country !== 'CH' && (
                <p>{contact.address.country}</p>
              )}
              {contact.email && (
                <p className="flex items-center gap-2 pt-1">
                  <Mail className="size-3.5" /> {contact.email}
                </p>
              )}
              {contact.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="size-3.5" /> {contact.phone}
                </p>
              )}
              <p className="pt-1 text-slate-400">Zahlungsfrist {contact.paymentTermDays} Tage</p>
            </div>
            {contact.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {contact.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
            )}
            {contact.note && (
              <p className="mt-3 rounded-lg bg-slate-50 p-2 text-sm text-slate-600">{contact.note}</p>
            )}
          </Card>

          <Card>
            <p className="text-xs text-slate-500">Umsatz gesamt</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatCHF(revenue)}</p>
            <p className="mt-1 text-xs text-slate-400">
              {orders.length} Shopify-Bestellungen · {docs.filter((d) => d.type === 'rechnung').length}{' '}
              Rechnungen
            </p>
          </Card>
        </div>

        {/* Historie */}
        <div className="space-y-6">
          <Card
            title="Shopify-Bestellungen"
            actions={<Link to="/shopify" className="text-xs text-brand-600 hover:underline">Shopify</Link>}
          >
            {orders.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Keine Bestellungen.</p>
            ) : (
              <TableWrap>
                <table className="w-full min-w-[440px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                      <th className="py-2">Nr.</th>
                      <th className="py-2">Datum</th>
                      <th className="py-2 text-right">Betrag</th>
                      <th className="py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 font-medium text-slate-700">{o.orderName}</td>
                        <td className="py-2 text-slate-500">{formatDate(o.date)}</td>
                        <td className="py-2 text-right">{formatCHF(o.total)}</td>
                        <td className="py-2 text-right">
                          <Badge tone={o.bookingStatus === 'booked' ? 'green' : 'amber'}>
                            {o.bookingStatus === 'booked' ? 'Verbucht' : 'Offen'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>

          <Card title="Offerten & Rechnungen">
            {docs.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Keine Dokumente.</p>
            ) : (
              <TableWrap>
                <table className="w-full min-w-[440px] text-sm">
                  <tbody>
                    {docs.map((d) => (
                      <tr
                        key={d.id}
                        className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                        onClick={() => navigate(`/dokumente/${d.id}`)}
                      >
                        <td className="py-2 font-medium text-slate-700">{d.number}</td>
                        <td className="py-2 text-slate-500">{DOCUMENT_TYPE_LABEL[d.type]}</td>
                        <td className="py-2 text-slate-500">{formatDate(d.date)}</td>
                        <td className="py-2 text-right">{formatCHF(d.total)}</td>
                        <td className="py-2 text-right text-slate-500">{d.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>

          {linkedTx.length > 0 && (
            <Card title="Verknüpfte Buchungen">
              <TableWrap>
                <table className="w-full min-w-[440px] text-sm">
                  <tbody>
                    {linkedTx.map((t) => (
                      <tr key={t.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 text-slate-500">{formatDate(t.date)}</td>
                        <td className="py-2">{t.description}</td>
                        <td
                          className={`py-2 text-right font-medium ${
                            t.kind === 'einnahme' ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {t.kind === 'ausgabe' ? '−' : '+'}
                          {formatCHF(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Card>
          )}
        </div>
      </div>

      {edit && (
        <ContactFormModal
          key={contact.id}
          open
          contact={contact}
          onClose={() => setEdit(false)}
          onDeleted={() => navigate('/kunden')}
        />
      )}
    </>
  )
}
