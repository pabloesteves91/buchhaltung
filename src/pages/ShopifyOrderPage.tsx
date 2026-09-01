import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PDFViewer } from '@react-pdf/renderer'
import { ArrowLeft, Download, Lock } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, Modal, TableWrap } from '@/components/ui'
import { useContacts } from '@/hooks/useContacts'
import { useSettings } from '@/hooks/useSettings'
import { useShopifyOrders } from '@/hooks/useShopify'
import { orderIsPaid, orderToDocument } from '@/lib/shopifyDocument'
import { DocumentPdf } from '@/pdf/DocumentPdf'
import { buildQrBillPng } from '@/pdf/qrBill'
import { downloadDocumentPdf } from '@/pdf/pdfActions'
import { lineNet } from '@/lib/documentTotals'
import { formatAmount, formatCHF, formatDate } from '@/lib/format'

export function ShopifyOrderPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { data: settings } = useSettings()
  const { data: contacts } = useContacts()
  const { data: orders } = useShopifyOrders()

  const [showPreview, setShowPreview] = useState(false)
  const [qrPng, setQrPng] = useState<string | null>(null)
  const [previewReceipt, setPreviewReceipt] = useState(false)

  const order = (orders ?? []).find((o) => o.id === orderId || o.orderId === orderId)
  const contact = contacts?.find((c) => c.id === order?.contactId)
  const paid = order ? orderIsPaid(order) : false

  const doc = useMemo(
    () => (order && settings ? orderToDocument(order, contact, settings) : null),
    [order, contact, settings],
  )

  if (!order || !settings || !doc) {
    return (
      <>
        <PageHeader title="Bestellung" />
        <p className="text-sm text-slate-400">
          {orders ? 'Bestellung nicht gefunden.' : 'Laden …'}
        </p>
        <Button variant="ghost" className="mt-3" onClick={() => navigate('/dokumente')}>
          <ArrowLeft className="size-4" /> Zurück
        </Button>
      </>
    )
  }

  async function preview(asReceipt: boolean) {
    setPreviewReceipt(asReceipt)
    setQrPng(asReceipt ? null : await buildQrBillPng(doc!, settings!))
    setShowPreview(true)
  }

  return (
    <>
      <PageHeader
        title={`Bestellung ${order.orderName}`}
        subtitle="Shopify-Bestellung – Nur-Lese-Ansicht"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-4" /> Zurück
            </Button>
            {paid ? (
              <>
                <Button variant="secondary" onClick={() => preview(true)}>
                  Vorschau Beleg
                </Button>
                <Button onClick={() => downloadDocumentPdf(doc, settings, { receipt: true })}>
                  <Download className="size-4" /> Beleg (PDF)
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => preview(false)}>
                  Vorschau Rechnung
                </Button>
                <Button onClick={() => downloadDocumentPdf(doc, settings, { withQr: true })}>
                  <Download className="size-4" /> Rechnung mit QR (PDF)
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={paid ? 'green' : 'amber'}>{paid ? 'Bezahlt' : 'Offen'}</Badge>
        <Badge tone={order.bookingStatus === 'booked' ? 'green' : 'slate'}>
          {order.bookingStatus === 'booked' ? 'In Buchhaltung verbucht' : 'Noch nicht verbucht'}
        </Badge>
        <span className="text-slate-400">Zahlungsstatus Shopify: {order.financialStatus}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card
          title={
            <span className="flex items-center gap-2">
              <Lock className="size-3.5 text-slate-400" />
              Bestelldetails (nicht bearbeitbar)
            </span>
          }
        >
          <div className="mb-3 text-sm text-slate-600">
            <p className="font-medium text-slate-800">
              {contact ? (
                <Link to={`/kunden/${contact.id}`} className="hover:underline">
                  {doc.recipientSnapshot.name}
                </Link>
              ) : (
                doc.recipientSnapshot.name
              )}
            </p>
            {doc.recipientSnapshot.address.map((l) => (
              <p key={l}>{l}</p>
            ))}
            <p className="mt-1 text-slate-400">Datum {formatDate(order.date)}</p>
          </div>
          <TableWrap>
            <table className="w-full min-w-[440px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="py-2">Bezeichnung</th>
                  <th className="py-2 text-right">Menge</th>
                  <th className="py-2 text-right">Preis</th>
                  <th className="py-2 text-right">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {doc.lineItems.map((it) => (
                  <tr key={it.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2">{it.description}</td>
                    <td className="py-2 text-right">
                      {formatAmount(it.quantity)} {it.unit}
                    </td>
                    <td className="py-2 text-right">{formatAmount(it.unitPrice)}</td>
                    <td className="py-2 text-right">{formatAmount(lineNet(it))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <div className="mt-3 flex justify-end">
            <div className="w-48 space-y-1 text-sm">
              <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
                <span>Total</span>
                <span>{formatCHF(order.total)}</span>
              </div>
              {paid && (
                <div className="flex justify-between text-green-700">
                  <span>Bezahlt</span>
                  <span>−{formatCHF(order.total)}</span>
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">
            {paid
              ? 'Diese Bestellung ist bezahlt. Der Beleg dient als Zahlungsbestätigung für den Kunden – ohne QR-Einzahlungsschein.'
              : 'Diese Bestellung ist noch offen. Die Rechnung enthält den Schweizer QR-Einzahlungsschein.'}
          </p>
          {order.bookingStatus !== 'booked' && (
            <Button variant="secondary" className="mt-3 w-full" onClick={() => navigate('/shopify')}>
              In der Shopify-Ansicht verbuchen
            </Button>
          )}
        </Card>
      </div>

      <Modal open={showPreview} onClose={() => setShowPreview(false)} title="PDF-Vorschau" wide>
        <div className="h-[82vh]">
          <PDFViewer width="100%" height="100%" showToolbar>
            <DocumentPdf
              document={doc}
              settings={settings}
              qrBillPng={qrPng}
              receipt={previewReceipt}
            />
          </PDFViewer>
        </div>
      </Modal>
    </>
  )
}
