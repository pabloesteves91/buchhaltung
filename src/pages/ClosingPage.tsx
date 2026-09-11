import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { pdf } from '@react-pdf/renderer'
import { AlertTriangle, CheckCircle2, Download, Lock, Unlock } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, Select } from '@/components/ui'
import { StatCard } from '@/components/StatCard'
import { useConfirm } from '@/hooks/useConfirm'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { useDocuments } from '@/hooks/useDocuments'
import { useShopifyOrders } from '@/hooks/useShopify'
import { useFiscalYears, useSaveFiscalYear } from '@/hooks/useFiscalYears'
import { useSettings } from '@/hooks/useSettings'
import { accountBalances, byCategory } from '@/lib/reporting'
import { downloadBlob } from '@/lib/backup'
import { YearEndReport } from '@/pdf/YearEndReport'
import { formatCHF, todayIso } from '@/lib/format'

export function ClosingPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear - 1 >= 2020 ? currentYear - 1 : currentYear)
  const { data: settings } = useSettings()
  const { data: allTx } = useTransactions()
  const { data: accounts } = useAccounts()
  const { data: docs } = useDocuments()
  const { data: orders } = useShopifyOrders()
  const { data: fiscalYears } = useFiscalYears()
  const saveFy = useSaveFiscalYear()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)

  const fy = (fiscalYears ?? []).find((f) => f.year === year)
  const closed = fy?.status === 'abgeschlossen'

  const yearTx = useMemo(() => (allTx ?? []).filter((t) => t.fiscalYear === year), [allTx, year])
  const categories = useMemo(() => byCategory(yearTx, accounts ?? []), [yearTx, accounts])
  const income = categories.filter((c) => c.kind === 'ertrag')
  const expense = categories.filter((c) => c.kind === 'aufwand')
  const result = income.reduce((s, l) => s + l.amount, 0) - expense.reduce((s, l) => s + l.amount, 0)

  const endOfYear = `${year}-12-31`
  const balancesAtYearEnd = useMemo(() => {
    const txThrough = (allTx ?? []).filter((t) => t.date <= endOfYear)
    return accountBalances(txThrough, accounts ?? [])
  }, [allTx, accounts, endOfYear])
  const assets = balancesAtYearEnd
    .filter((b) => b.account.type === 'aktiven')
    .map((b) => ({ number: b.account.number, name: b.account.name, amount: b.balance }))

  const checks = useMemo(() => {
    const unbookedOrders = (orders ?? []).filter(
      (o) => o.date.startsWith(String(year)) && o.bookingStatus === 'open',
    ).length
    const drafts = (docs ?? []).filter(
      (d) => d.fiscalYear === year && d.status === 'entwurf',
    ).length
    const openInvoices = (docs ?? []).filter(
      (d) =>
        d.fiscalYear === year &&
        d.type === 'rechnung' &&
        ['versendet', 'teilbezahlt', 'ueberfaellig'].includes(d.status),
    ).length
    return [
      {
        ok: unbookedOrders === 0,
        label: `Shopify-Bestellungen ${year} verbucht`,
        detail: unbookedOrders > 0 ? `${unbookedOrders} noch offen` : 'alle verbucht',
        to: '/shopify',
      },
      {
        ok: drafts === 0,
        label: 'Keine Dokument-Entwürfe',
        detail: drafts > 0 ? `${drafts} Entwürfe` : 'keine',
        to: '/dokumente',
      },
      {
        ok: true,
        label: 'Offene Rechnungen',
        detail: openInvoices > 0 ? `${openInvoices} offen (Info)` : 'keine',
        to: '/dokumente',
      },
      {
        ok: yearTx.length > 0,
        label: `Buchungen für ${year} vorhanden`,
        detail: `${yearTx.length} Buchungen`,
        to: '/journal',
      },
    ]
  }, [orders, docs, yearTx, year])

  const blocking = checks.filter((c) => !c.ok && c.label !== 'Offene Rechnungen')

  async function downloadReport() {
    if (!settings) return
    const blob = await pdf(
      <YearEndReport
        settings={settings}
        year={year}
        income={income}
        expense={expense}
        assets={assets}
        liabilities={[]}
      />,
    ).toBlob()
    downloadBlob(`Jahresabschluss_${year}.pdf`, blob)
  }

  async function closeYear() {
    setBusy(true)
    try {
      await saveFy.mutateAsync({
        id: String(year),
        year,
        start: `${year}-01-01`,
        end: endOfYear,
        status: 'abgeschlossen',
        lockedThrough: endOfYear,
        closingResult: result,
        closedAt: todayIso(),
      })
    } finally {
      setBusy(false)
    }
  }

  async function reopenYear() {
    if (
      !(await confirm({
        title: `Geschäftsjahr ${year} wieder öffnen?`,
        description: `Buchungen bis ${endOfYear} sind danach wieder änderbar.`,
        confirmLabel: 'Sperre aufheben',
      }))
    )
      return
    setBusy(true)
    try {
      await saveFy.mutateAsync({
        id: String(year),
        year,
        start: `${year}-01-01`,
        end: endOfYear,
        status: 'offen',
        lockedThrough: undefined,
        closingResult: result,
      })
    } finally {
      setBusy(false)
    }
  }

  const years = Array.from({ length: 6 }, (_, i) => currentYear - i)

  return (
    <>
      <PageHeader
        title="Jahresabschluss"
        subtitle="Kontrolle, Bericht und Periodensperre."
        actions={
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        }
      />

      {closed && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <Lock className="size-4" />
          Geschäftsjahr {year} ist abgeschlossen (am {fy?.closedAt}). Buchungen bis {endOfYear} sind
          gesperrt.
          <Button size="sm" variant="ghost" onClick={reopenYear} disabled={busy} loading={busy}>
            {!busy && <Unlock className="size-3.5" />} Sperre aufheben
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card title="Kontrolle vor dem Abschluss">
            <ul className="space-y-2 text-sm">
              {checks.map((c) => (
                <li key={c.label} className="flex items-center gap-2">
                  {c.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success" />
                  ) : (
                    <AlertTriangle className="size-4 shrink-0 text-warning" />
                  )}
                  <span className="text-foreground">{c.label}</span>
                  <Link to={c.to} className="text-xs text-muted-foreground transition-colors hover:text-brand-600">
                    {c.detail}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card title={`Erfolgsrechnung ${year}`}>
            <table className="w-full text-sm">
              <tbody>
                {income.map((l) => (
                  <tr key={l.accountId} className="border-b border-border/70">
                    <td className="py-1.5 text-muted-foreground">
                      {l.number} {l.name}
                    </td>
                    <td className="py-1.5 text-right text-success tabular-nums">{formatCHF(l.amount)}</td>
                  </tr>
                ))}
                {expense.map((l) => (
                  <tr key={l.accountId} className="border-b border-border/70">
                    <td className="py-1.5 text-muted-foreground">
                      {l.number} {l.name}
                    </td>
                    <td className="py-1.5 text-right text-destructive tabular-nums">−{formatCHF(l.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 font-semibold">{result >= 0 ? 'Gewinn' : 'Verlust'}</td>
                  <td className="py-2 text-right font-semibold">{formatCHF(result)}</td>
                </tr>
              </tbody>
            </table>
          </Card>

          <Card title={`Vermögen per ${endOfYear}`}>
            <table className="w-full text-sm">
              <tbody>
                {assets.map((a) => (
                  <tr key={a.number} className="border-b border-border/70 last:border-0">
                    <td className="py-1.5 text-muted-foreground">
                      {a.number} {a.name}
                    </td>
                    <td className="py-1.5 text-right font-medium">{formatCHF(a.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <StatCard
            label={`Ergebnis ${year}`}
            value={formatCHF(result)}
            tone={result >= 0 ? 'positive' : 'negative'}
          />

          <Button variant="secondary" className="w-full" onClick={downloadReport}>
            <Download className="size-4" /> Bericht als PDF
          </Button>

          {!closed && (
            <>
              {blocking.length > 0 && (
                <p className="rounded-lg bg-amber-100 p-2 text-xs text-amber-900">
                  {blocking.length} Punkt(e) offen. Du kannst trotzdem abschliessen, prüfe sie aber
                  zuerst.
                </p>
              )}
              <Button
                className="w-full"
                onClick={async () => {
                  if (
                    await confirm({
                      title: `Geschäftsjahr ${year} abschliessen?`,
                      description: `Buchungen mit Datum bis ${endOfYear} werden gesperrt. Später wieder aufhebbar.`,
                      confirmLabel: 'Abschliessen',
                    })
                  )
                    void closeYear()
                }}
                disabled={busy}
                loading={busy}
              >
                {!busy && <Lock className="size-4" />} Jahr {year} abschliessen
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
