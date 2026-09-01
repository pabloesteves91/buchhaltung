import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, TableWrap } from '@/components/ui'
import { cn } from '@/lib/cn'
import { DOCUMENT_TYPE_LABEL, useDocuments } from '@/hooks/useDocuments'
import { useShopifyOrders, type ShopifyBookingStatus } from '@/hooks/useShopify'
import { amountPaid } from '@/lib/documentTotals'
import { formatCHF, formatDate } from '@/lib/format'
import type { BusinessDocument, DocumentStatus, DocumentType } from '@/lib/types'

type Tab = DocumentType | 'all' | 'shopify'

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'offerte', label: 'Offerten' },
  { key: 'rechnung', label: 'Rechnungen' },
  { key: 'gutschrift', label: 'Gutschriften' },
  { key: 'lieferschein', label: 'Lieferscheine' },
  { key: 'shopify', label: 'Shopify-Bestellungen' },
]

const STATUS: Record<DocumentStatus, { label: string; tone: 'slate' | 'green' | 'amber' | 'red' | 'blue' }> = {
  entwurf: { label: 'Entwurf', tone: 'slate' },
  versendet: { label: 'Versendet', tone: 'blue' },
  teilbezahlt: { label: 'Teilbezahlt', tone: 'amber' },
  bezahlt: { label: 'Bezahlt', tone: 'green' },
  ueberfaellig: { label: 'Überfällig', tone: 'red' },
  storniert: { label: 'Storniert', tone: 'slate' },
}

const ORDER_STATUS: Record<ShopifyBookingStatus, { label: string; tone: 'slate' | 'green' | 'amber' | 'red' | 'blue' }> = {
  open: { label: 'Nicht verbucht', tone: 'amber' },
  booked: { label: 'Verbucht', tone: 'green' },
  cancelled: { label: 'Storniert', tone: 'slate' },
  refunded: { label: 'Retoure verbucht', tone: 'blue' },
  refund_pending: { label: 'Retoure offen', tone: 'red' },
}

export function DocumentsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('all')
  const { data: docs, isLoading } = useDocuments(
    tab === 'all' || tab === 'shopify' ? undefined : tab,
  )
  const { data: orders } = useShopifyOrders()

  const openInvoiceTotal = useMemo(() => {
    return (docs ?? [])
      .filter((d) => d.type === 'rechnung' && ['versendet', 'teilbezahlt', 'ueberfaellig'].includes(d.status))
      .reduce((s, d) => s + (d.total - amountPaid(d)), 0)
  }, [docs])

  return (
    <>
      <PageHeader
        title="Offerten & Rechnungen"
        subtitle="Dokumente und Shopify-Bestellungen an einem Ort."
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
          <p className="text-xs text-slate-500">Offene Rechnungen</p>
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
            {t.key === 'shopify' && (orders?.length ?? 0) > 0 && (
              <span className="ml-1.5 text-xs opacity-70">({orders?.length})</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'shopify' ? (
        (orders?.length ?? 0) === 0 ? (
          <EmptyState
            title="Keine Shopify-Bestellungen"
            description="Verbinde Shopify und importiere die Bestellungen."
            action={<Button onClick={() => navigate('/shopify')}>Zu Shopify</Button>}
          />
        ) : (
          <Card>
            <TableWrap>
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="py-2">Bestellung</th>
                    <th className="py-2">Kunde</th>
                    <th className="py-2">Datum</th>
                    <th className="py-2">Zahlung</th>
                    <th className="py-2 text-right">Total</th>
                    <th className="py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(orders ?? []).map((o) => (
                    <tr
                      key={o.id}
                      className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                      onClick={() => navigate(`/shopify/bestellung/${o.id}`)}
                    >
                      <td className="py-2 font-medium text-slate-700">{o.orderName}</td>
                      <td className="py-2 text-slate-600">
                        {o.contactId ? (
                          <Link
                            to={`/kunden/${o.contactId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:underline"
                          >
                            {o.customerName}
                          </Link>
                        ) : (
                          o.customerName
                        )}
                      </td>
                      <td className="py-2 whitespace-nowrap text-slate-500">{formatDate(o.date)}</td>
                      <td className="py-2 text-slate-500">{o.financialStatus}</td>
                      <td className="py-2 text-right font-medium">{formatCHF(o.total)}</td>
                      <td className="py-2 text-right">
                        <Badge tone={ORDER_STATUS[o.bookingStatus].tone}>
                          {ORDER_STATUS[o.bookingStatus].label}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Card>
        )
      ) : isLoading ? (
        <p className="text-sm text-slate-400">Laden …</p>
      ) : (docs?.length ?? 0) === 0 ? (
        <EmptyState
          title="Noch keine Dokumente"
          description="Erstelle eine Offerte oder Rechnung – Kunde wählen, Positionen erfassen, als PDF exportieren."
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
                {(docs as BusinessDocument[]).map((d) => (
                  <tr
                    key={d.id}
                    className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    onClick={() => navigate(`/dokumente/${d.id}`)}
                  >
                    <td className="py-2 font-medium text-slate-700">
                      <Link to={`/dokumente/${d.id}`} onClick={(e) => e.stopPropagation()}>
                        {d.number}
                      </Link>
                    </td>
                    <td className="py-2 text-slate-500">{DOCUMENT_TYPE_LABEL[d.type]}</td>
                    <td className="py-2 text-slate-600">{d.recipientSnapshot.name}</td>
                    <td className="py-2 whitespace-nowrap text-slate-500">{formatDate(d.date)}</td>
                    <td className="py-2 text-right font-medium">{formatCHF(d.total)}</td>
                    <td className="py-2 text-right">
                      <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge>
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
