import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { CompanySettings } from '@/lib/types'
import type { CategoryLine } from '@/lib/reporting'
import { formatAmount } from '@/lib/format'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1a1d23',
    padding: 48,
    lineHeight: 1.4,
  },
  h1: { fontFamily: 'Helvetica-Bold', fontSize: 15 },
  sub: { color: '#55606e', marginBottom: 20 },
  h2: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    marginTop: 18,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderColor: '#1a1d23',
    paddingBottom: 3,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5 },
  num: { width: 40, color: '#8a94a1' },
  name: { flex: 1 },
  amount: { width: 90, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#1a1d23',
    marginTop: 4,
    paddingTop: 4,
    fontFamily: 'Helvetica-Bold',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 2,
    borderColor: '#1a1d23',
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  foot: { marginTop: 48, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#55606e' },
  sig: { borderTopWidth: 0.5, borderColor: '#8a94a1', width: 180, paddingTop: 4 },
})

function Section({
  title,
  lines,
}: {
  title: string
  lines: { number?: string; name: string; amount: number }[]
}) {
  const total = lines.reduce((s, l) => s + l.amount, 0)
  return (
    <>
      <Text style={styles.h2}>{title}</Text>
      {lines.length === 0 ? (
        <Text style={{ color: '#8a94a1' }}>keine</Text>
      ) : (
        lines.map((l, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.num}>{l.number ?? ''}</Text>
            <Text style={styles.name}>{l.name}</Text>
            <Text style={styles.amount}>{formatAmount(l.amount)}</Text>
          </View>
        ))
      )}
      <View style={styles.totalRow}>
        <Text>Total {title}</Text>
        <Text>{formatAmount(total)}</Text>
      </View>
    </>
  )
}

export function YearEndReport({
  settings,
  year,
  income,
  expense,
  assets,
  liabilities,
}: {
  settings: CompanySettings
  year: number
  income: CategoryLine[]
  expense: CategoryLine[]
  assets: { number: string; name: string; amount: number }[]
  liabilities: { number: string; name: string; amount: number }[]
}) {
  const result =
    income.reduce((s, l) => s + l.amount, 0) - expense.reduce((s, l) => s + l.amount, 0)

  return (
    <Document title={`Jahresabschluss ${year} – ${settings.name}`} author={settings.name}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Jahresabschluss {year}</Text>
        <Text style={styles.sub}>
          {settings.name}
          {settings.legalForm ? ` · ${settings.legalForm}` : ''} ·{' '}
          {settings.address.zip} {settings.address.city} · Einnahmen-/Ausgabenrechnung
        </Text>

        <Text style={styles.h2}>Erfolgsrechnung</Text>
        <Section title="Ertrag" lines={income} />
        <View style={{ marginTop: 10 }} />
        <Section title="Aufwand" lines={expense} />
        <View style={styles.resultRow}>
          <Text>{result >= 0 ? 'Gewinn' : 'Verlust'} {year}</Text>
          <Text>{formatAmount(result)}</Text>
        </View>

        <Section title="Aktiven (Stand 31.12.)" lines={assets} />
        <View style={{ marginTop: 10 }} />
        <Section title="Passiven (Stand 31.12.)" lines={liabilities} />

        {settings.taxMode === 'none' && (
          <Text style={{ marginTop: 16, fontSize: 8, color: '#8a94a1' }}>
            {settings.name} ist nicht mehrwertsteuerpflichtig.
          </Text>
        )}

        <View style={styles.foot}>
          <View style={styles.sig}>
            <Text>Ort, Datum</Text>
          </View>
          <View style={styles.sig}>
            <Text>Unterschrift</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
