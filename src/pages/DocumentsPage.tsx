import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, TableWrap } from '@/components/ui'
import { cn } from '@/lib/cn'
import { DOCUMENT_TYPE_LABEL, useDocuments } from '@/hooks/useDocuments'
import { useShopifyOrders } from '@/hooks/useShopify'
import { amountPaid } from '@/lib/documentTotals'
import { orderIsPaid } from '@/lib/shopifyDocument'
import { formatCHF, formatDate } from '@/lib/format'
import type { DocumentStatus, DocumentType } from '@/lib/types'

type Tab = DocumentType | 'all'

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'offerte', label: 'Offerten' },
  { key: 'rechnung', label: 'Rechnungen' },
  { key: 'gutschrift', label: 'Gutschriften' },
  { key: 'lieferschein', label: 'Lieferscheine' },
]

const STATUS: Record<DocumentStatus, { label: string; tone: 'slate' | 'green' | 'amber' | 'red' | 'blue' }> = {
  entwurf: { label: 'Entwurf', tone: 'slate' },
  versendet: { label: 'Versendet', tone: 'blue' },
  teilbezahlt: { label: 'Teilbezahlt', tone: 'amber' },
  bezahlt: { label: 'Bezahlt', tone: 'green' },
  ueberfaellig: { label: 'Überfällig', tone: 'red' },
  storniert: { label: 'Storniert', tone: 'slate' },
}

interface Row {
  key: string
  to: string
  number: string
  typeLabel: string
  isShopify: boolean
  customer: string
  customerLink?: string
  date: string
  total: number
  statusLabel: string
  statusTone: 'slate' | 'green' | 'amber' | 'red' | 'blue'
}

export function DocumentsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('all')
  const { data: docs, isLoading } = useDocuments(tab === 'all' ? undefined : tab)
  const { data: orders } = useShopifyOrders()

  // Shopify orders behave like sales invoices → show them in "Alle" and "Rechnungen".
  const showOrders = tab === 'all' || tab === 'rechnung'

  const rows = useMemo<Row[]>(() => {
    const docRows: Row[] = (docs ?? []).map((d) => ({
      key: `doc-${d.id}`,
      to: `/dokumente/${d.id}`,
      number: d.number,
      typeLabel: DOCUMENT_TYPE_LABEL[d.type],
      isShopify: false,
      customer: d.recipientSnapshot.name,
      customerLink: d.contactId ? `/kunden/${d.contactId}` : undefined,
      date: d.date,
      total: d.total,
      statusLabel: STATUS[d.status].label,
      statusTone: STATUS[d.status].tone,
    }))
    const orderRows: Row[] = showOrders
      ? (orders ?? []).map((o) => ({
          key: `order-${o.id}`,
          to: `/shopify/bestellung/${o.id}`,
          number: o.orderName,
          typeLabel: 'Shopify',
          isShopify: true,
          customer: o.customerName,
          customerLink: o.contactId ? `/kunden/${o.contactId}` : undefined,
          date: o.date,
          total: o.total,
          statusLabel: orderIsPaid(o) ? 'Bezahlt' : 'Offen',
          statusTone: orderIsPaid(o) ? 'green' : 'amber',
        }))
      : []
    return [...docRows, ...orderRows].sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [docs, orders, showOrders])

  const openInvoiceTotal = useMemo(() => {
    const fromDocs = (docs ?? [])
      .filter((d) => d.type === 'rechnung' && ['versendet', 'teilbezahlt', 'ueberfaellig'].includes(d.status))
      .reduce((s, d) => s + (d.total - amountPaid(d)), 0)
    const fromOrders = (orders ?? [])
      .filter((o) => !orderIsPaid(o) && o.bookingStatus !== 'cancelled')
      .reduce((s, o) => s + o.total, 0)
    return fromDocs + fromOrders
  }, [docs, orders])

  return (
    <>
      <PageHeader
        title="Offerten & Rechnungen"
        subtitle="Eigene Dokumente und Shopify-Bestellungen an einem Ort."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate('/dokumente/neu?typ=offerte')}>
              <Plus className="size-4" /> Offerte
            </Button>
            <Button onClick={() => navigate('/dokumente/neu?typ=rechnung')}>
              <Plus className="size-4" /> Rechnung
            </Button>
          </div>
        }
      />

      {openInvoiceTotal > 0 && (
        <Card className="mb-4">
          <p className="text-xs text-slate-500">Offen (Rechnungen + unbezahlte Shopify-Bestellungen)</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatCHF(openInvoiceTotal)}</p>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium',
              tab === t.key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Laden …</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Noch keine Dokumente"
          description="Erstelle eine Offerte oder Rechnung – oder importiere die Shopify-Bestellungen."
          action={
            <Button onClick={() => navigate('/dokumente/neu?typ=rechnung')}>Rechnung erstellen</Button>
          }
        />
      ) : (
        <Card>
          <TableWrap>
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="py-2">Nummer</th>
                  <th className="py-2">Typ</th>
                  <th className="py-2">Kunde</th>
                  <th className="py-2">Datum</th>
                  <th className="py-2 text-right">Total</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    onClick={() => navigate(r.to)}
                  >
                    <td className="py-2 font-medium text-slate-700">
                      <Link to={r.to} onClick={(e) => e.stopPropagation()}>
                        {r.number}
                      </Link>
                    </td>
                    <td className="py-2">
                      {r.isShopify ? (
                        <Badge tone="blue">Shopify</Badge>
                      ) : (
                        <span className="text-slate-500">{r.typeLabel}</span>
                      )}
                    </td>
                    <td className="py-2 text-slate-600">
                      {r.customerLink ? (
                        <Link
                          to={r.customerLink}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline"
                        >
                          {r.customer}
                        </Link>
                      ) : (
                        r.customer
                      )}
                    </td>
                    <td className="py-2 whitespace-nowrap text-slate-500">{formatDate(r.date)}</td>
                    <td className="py-2 text-right font-medium">{formatCHF(r.total)}</td>
                    <td className="py-2 text-right">
                      <Badge tone={r.statusTone}>{r.statusLabel}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}
    </>
  )
}
