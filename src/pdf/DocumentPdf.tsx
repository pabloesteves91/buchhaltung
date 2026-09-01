import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import type { BusinessDocument, CompanySettings } from '@/lib/types'
import { DOCUMENT_TYPE_LABEL } from '@/hooks/useDocuments'
import { computeTotals, lineNet } from '@/lib/documentTotals'
import { formatAmount, formatDate } from '@/lib/format'

// Only the 14 standard PDF fonts are used (Helvetica) so the output is byte-stable
// across machines — no font files to download, no substitution.
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1a1d23',
    paddingTop: 48,
    paddingBottom: 64,
    paddingHorizontal: 48,
    lineHeight: 1.4,
  },
  pageWithQr: { paddingBottom: 320 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { maxWidth: 150, maxHeight: 56, objectFit: 'contain' },
  companyBlock: { textAlign: 'right', fontSize: 8, color: '#55606e' },
  companyName: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#1a1d23' },
  addressBlock: { marginTop: 56, fontSize: 10 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 32 },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 16 },
  metaTable: { fontSize: 9, textAlign: 'right' },
  metaLine: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  metaLabel: { color: '#55606e' },
  intro: { marginTop: 20 },
  table: { marginTop: 16 },
  tHead: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#1a1d23',
    paddingBottom: 4,
    fontFamily: 'Helvetica-Bold',
  },
  tRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: '#d7dbe0',
    paddingVertical: 4,
  },
  cPos: { width: 24 },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 56, textAlign: 'right' },
  cPrice: { width: 64, textAlign: 'right' },
  cDisc: { width: 44, textAlign: 'right' },
  cSum: { width: 68, textAlign: 'right' },
  totals: { marginTop: 12, marginLeft: 'auto', width: 220 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#1a1d23',
    marginTop: 4,
    paddingTop: 4,
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  outro: { marginTop: 20 },
  // The Swiss QR payment part is a regulated 210 × 105 mm block anchored to the
  // very bottom of the (last) page. 105 mm = 297.64 pt, 210 mm = 595.28 pt.
  qrZone: { position: 'absolute', bottom: 0, left: 0, width: 595.28, height: 297.64 },
  qrImage: { width: 595.28, height: 297.64 },
  footer: {
    position: 'absolute',
    bottom: 306,
    left: 48,
    right: 48,
    paddingTop: 6,
    fontSize: 7.5,
    color: '#8a94a1',
    textAlign: 'center',
  },
  footerNoQr: {
    position: 'absolute',
    bottom: 28,
    left: 48,
    right: 48,
    borderTopWidth: 0.5,
    borderColor: '#d7dbe0',
    paddingTop: 6,
    fontSize: 7.5,
    color: '#8a94a1',
    textAlign: 'center',
  },
})

function companyAddressLines(s: CompanySettings): string[] {
  return [
    s.name,
    s.address.line1,
    s.address.line2,
    `${s.address.zip} ${s.address.city}`.trim(),
    s.phone ? `Tel. ${s.phone}` : '',
    s.email,
    s.website,
  ].filter(Boolean) as string[]
}

export function DocumentPdf({
  document: d,
  settings,
  qrBillPng,
  receipt,
  headingOverride,
}: {
  document: BusinessDocument
  settings: CompanySettings
  qrBillPng?: string | null
  receipt?: boolean
  headingOverride?: string
}) {
  const isInvoice = d.type === 'rechnung'
  const withQr = Boolean(qrBillPng)
  const heading = headingOverride ?? (receipt ? 'Beleg' : DOCUMENT_TYPE_LABEL[d.type])
  const paid = d.status === 'bezahlt'

  // Recompute the discount/shipping breakdown for display; `d.total` stays authoritative.
  const hasBreakdown =
    (d.discounts?.length ?? 0) > 0 || (d.shipping ?? 0) > 0 || d.globalDiscountPct > 0
  const bt = hasBreakdown
    ? computeTotals({
        lineItems: d.lineItems,
        type: d.type,
        globalDiscountPct: d.globalDiscountPct,
        discounts: d.discounts,
        shipping: d.shipping,
      })
    : null
  return (
    <Document
      title={`${heading} ${d.number}`}
      author={settings.name}
      creator="nipponnites Buchhaltung"
      producer="nipponnites Buchhaltung"
    >
      <Page size="A4" style={withQr ? [styles.page, styles.pageWithQr] : styles.page}>
        <View style={styles.headerRow}>
          {settings.logoDataUrl ? (
            <Image src={settings.logoDataUrl} style={styles.logo} />
          ) : (
            <Text style={styles.companyName}>{settings.name}</Text>
          )}
          <View style={styles.companyBlock}>
            {companyAddressLines(settings).map((l, i) => (
              <Text key={i} style={i === 0 ? styles.companyName : undefined}>
                {l}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.addressBlock}>
          {d.recipientSnapshot.name ? <Text>{d.recipientSnapshot.name}</Text> : null}
          {d.recipientSnapshot.address.map((l, i) => (
            <Text key={i}>{l}</Text>
          ))}
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.title}>
            {heading} {d.number}
          </Text>
          <View style={styles.metaTable}>
            <View style={styles.metaLine}>
              <Text style={styles.metaLabel}>Datum</Text>
              <Text>{formatDate(d.date)}</Text>
            </View>
            {d.dueDate ? (
              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>
                  {isInvoice ? 'Zahlbar bis' : 'Gültig bis'}
                </Text>
                <Text>{formatDate(d.dueDate)}</Text>
              </View>
            ) : null}
            {settings.contactPerson ? (
              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>Ihr Kontakt</Text>
                <Text>{settings.contactPerson}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {d.introText ? <Text style={styles.intro}>{d.introText}</Text> : null}

        <View style={styles.table}>
          <View style={styles.tHead}>
            <Text style={styles.cPos}>Pos</Text>
            <Text style={styles.cDesc}>Bezeichnung</Text>
            <Text style={styles.cQty}>Menge</Text>
            <Text style={styles.cPrice}>Preis</Text>
            <Text style={styles.cDisc}>Rab.</Text>
            <Text style={styles.cSum}>Betrag</Text>
          </View>
          {d.lineItems.map((it, i) => (
            <View key={it.id} style={styles.tRow} wrap={false}>
              <Text style={styles.cPos}>{i + 1}</Text>
              <Text style={styles.cDesc}>{it.description}</Text>
              <Text style={styles.cQty}>
                {formatAmount(it.quantity)} {it.unit}
              </Text>
              <Text style={styles.cPrice}>{formatAmount(it.unitPrice)}</Text>
              <Text style={styles.cDisc}>{it.discountPct ? `${it.discountPct}%` : '–'}</Text>
              <Text style={styles.cSum}>{formatAmount(lineNet(it))}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          {bt ? (
            <>
              <View style={styles.totalLine}>
                <Text>Zwischensumme</Text>
                <Text>{formatAmount(bt.subtotal)}</Text>
              </View>
              {bt.discountLines
                .filter((l) => !l.isShipping)
                .map((l, i) => (
                  <View key={i} style={styles.totalLine}>
                    <Text>{l.label}</Text>
                    <Text>−{formatAmount(l.amount)}</Text>
                  </View>
                ))}
              {bt.shipping > 0 && (
                <View style={styles.totalLine}>
                  <Text>Versand</Text>
                  <Text>{formatAmount(bt.shipping)}</Text>
                </View>
              )}
              {bt.freeShipping && bt.shipping > 0 && (
                <View style={styles.totalLine}>
                  <Text>Gratis Versand</Text>
                  <Text>−{formatAmount(bt.shipping)}</Text>
                </View>
              )}
            </>
          ) : d.discountTotal > 0 ? (
            <>
              <View style={styles.totalLine}>
                <Text>Zwischensumme</Text>
                <Text>{formatAmount(d.subtotal)}</Text>
              </View>
              <View style={styles.totalLine}>
                <Text>Rabatt</Text>
                <Text>−{formatAmount(d.discountTotal)}</Text>
              </View>
            </>
          ) : null}
          {Math.abs(d.roundingDelta) >= 0.01 && (
            <View style={styles.totalLine}>
              <Text>Rundung</Text>
              <Text>
                {d.roundingDelta > 0 ? '+' : '−'}
                {formatAmount(Math.abs(d.roundingDelta))}
              </Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text>Total CHF</Text>
            <Text>{formatAmount(d.total)}</Text>
          </View>
          {paid && (
            <View style={[styles.totalLine, { marginTop: 4 }]}>
              <Text style={{ color: '#0a7a3d', fontFamily: 'Helvetica-Bold' }}>Bezahlt</Text>
              <Text style={{ color: '#0a7a3d', fontFamily: 'Helvetica-Bold' }}>
                −{formatAmount(d.total)}
              </Text>
            </View>
          )}
        </View>

        {settings.taxMode === 'none' && isInvoice ? (
          <Text style={{ marginTop: 8, fontSize: 8, color: '#8a94a1' }}>
            Nicht MWST-pflichtig – es wird keine Mehrwertsteuer ausgewiesen.
          </Text>
        ) : null}

        {d.outroText ? <Text style={styles.outro}>{d.outroText}</Text> : null}

        {settings.invoice.footerText ? (
          <Text style={withQr ? styles.footer : styles.footerNoQr} fixed>
            {settings.invoice.footerText}
          </Text>
        ) : null}

        {qrBillPng ? (
          <View
            fixed
            style={styles.qrZone}
            render={(props) => {
              const { pageNumber, totalPages } = props as unknown as {
                pageNumber: number
                totalPages: number
              }
              return pageNumber === totalPages ? (
                <Image src={qrBillPng} style={styles.qrImage} />
              ) : null
            }}
          />
        ) : null}
      </Page>
    </Document>
  )
}
