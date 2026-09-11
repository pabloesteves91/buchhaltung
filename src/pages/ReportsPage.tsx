import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, EmptyState, Field, Input, Select, TableWrap } from '@/components/ui'
import { StatCard } from '@/components/StatCard'
import { cn } from '@/lib/cn'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { useDocuments } from '@/hooks/useDocuments'
import { useProducts } from '@/hooks/useProducts'
import { useShopifyOrders } from '@/hooks/useShopify'
import {
  accountBalances,
  byCategory,
  discountUsage,
  downloadCsv,
  monthlyBuckets,
  orderMargin,
  reactivationCandidates,
  toCsv,
  topCustomers,
  topProducts,
} from '@/lib/reporting'
import { orderDiscount } from '@/lib/shopifyDocument'
import { formatCHF } from '@/lib/format'

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

export function ReportsPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const { data: allTx } = useTransactions()
  const { data: accounts } = useAccounts()
  const { data: docs } = useDocuments()
  const { data: orders } = useShopifyOrders()
  const { data: articles } = useProducts()

  const yearTx = useMemo(
    () => (allTx ?? []).filter((t) => t.fiscalYear === year),
    [allTx, year],
  )

  const kpi = useMemo(() => {
    let inc = 0
    let exp = 0
    for (const t of yearTx) {
      if (t.kind === 'einnahme') inc += t.amount
      else if (t.kind === 'ausgabe') exp += t.amount
    }
    return { inc, exp, net: inc - exp }
  }, [yearTx])

  const months = useMemo(() => monthlyBuckets(yearTx), [yearTx])
  const maxMonth = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]))

  const yearComparison = useMemo(() => {
    const map = new Map<number, { inc: number; exp: number }>()
    for (const t of allTx ?? []) {
      const y = t.fiscalYear
      const cur = map.get(y) ?? { inc: 0, exp: 0 }
      if (t.kind === 'einnahme') cur.inc += t.amount
      else if (t.kind === 'ausgabe') cur.exp += t.amount
      map.set(y, cur)
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]).slice(0, 5)
  }, [allTx])

  const categories = useMemo(
    () => byCategory(yearTx, accounts ?? []),
    [yearTx, accounts],
  )
  const income = categories.filter((c) => c.kind === 'ertrag')
  const expense = categories.filter((c) => c.kind === 'aufwand')

  const balances = useMemo(
    () => accountBalances(allTx ?? [], accounts ?? []),
    [allTx, accounts],
  )
  const liquidity = balances.reduce((s, b) => s + b.balance, 0)

  const customers = useMemo(
    () => topCustomers(orders ?? [], docs ?? []).slice(0, 10),
    [orders, docs],
  )
  const products = useMemo(() => topProducts(orders ?? []).slice(0, 10), [orders])
  const discounts = useMemo(
    () => discountUsage(orders ?? [], orderDiscount).slice(0, 10),
    [orders],
  )
  const reactivation = useMemo(
    () => reactivationCandidates(orders ?? [], docs ?? []).slice(0, 10),
    [orders, docs],
  )
  const margin = useMemo(() => orderMargin(orders ?? []), [orders])

  // Basis-Kennzahlen für den Rabattaktions-Simulator: Ø Bestellwert aus den
  // Shopify-Bestellungen, Ø Marge % aus den Artikeln mit hinterlegtem EK.
  const activeOrders = (orders ?? []).filter((o) => o.bookingStatus !== 'cancelled')
  const avgOrderValue =
    activeOrders.length > 0
      ? activeOrders.reduce((s, o) => s + o.total, 0) / activeOrders.length
      : 0
  const costedArticles = (articles ?? []).filter((p) => p.cost != null && p.price > 0)
  const avgMarginPctFromArticles =
    costedArticles.length > 0
      ? (costedArticles.reduce((s, p) => s + (p.price - (p.cost ?? 0)) / p.price, 0) /
          costedArticles.length) *
        100
      : null

  const [discountPct, setDiscountPct] = useState(10)
  const [expectedOrders, setExpectedOrders] = useState(10)
  const [marginPctInput, setMarginPctInput] = useState('')
  const marginPct = marginPctInput !== '' ? Number(marginPctInput) : (avgMarginPctFromArticles ?? 30)

  const sim = useMemo(() => {
    const cost = avgOrderValue * (1 - marginPct / 100)
    const normalMargin = avgOrderValue - cost
    const discountedPrice = avgOrderValue * (1 - discountPct / 100)
    const discountedMargin = discountedPrice - cost
    const totalMarginNormal = normalMargin * expectedOrders
    const totalMarginDiscounted = discountedMargin * expectedOrders
    const breakEvenOrders = discountedMargin > 0 ? totalMarginNormal / discountedMargin : null
    return {
      discountedPrice,
      normalMargin,
      discountedMargin,
      totalMarginNormal,
      totalMarginDiscounted,
      extraOrdersNeeded: breakEvenOrders != null ? Math.max(0, breakEvenOrders - expectedOrders) : null,
    }
  }, [avgOrderValue, marginPct, discountPct, expectedOrders])

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const hasData = (allTx?.length ?? 0) > 0 || (orders?.length ?? 0) > 0

  function exportCategories() {
    const rows: (string | number)[][] = [['Konto', 'Bezeichnung', 'Art', 'Betrag']]
    for (const c of categories) rows.push([c.number, c.name, c.kind, c.amount])
    rows.push([])
    rows.push(['', 'Ergebnis', '', kpi.net])
    downloadCsv(`Auswertung_${year}.csv`, toCsv(rows))
  }

  return (
    <>
      <PageHeader
        title="Auswertungen"
        subtitle="Umsatz, Kategorien, Liquidität und Top-Listen."
        actions={
          <>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={exportCategories}>
              <Download className="size-4" /> CSV
            </Button>
          </>
        }
      />

      {!hasData ? (
        <EmptyState
          title="Noch keine Daten"
          description="Erfasse Buchungen oder importiere Shopify-Bestellungen, dann erscheinen hier Auswertungen."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatCard label={`Einnahmen ${year}`} value={formatCHF(kpi.inc)} tone="positive" />
            <StatCard label={`Ausgaben ${year}`} value={formatCHF(kpi.exp)} tone="negative" />
            <StatCard label={`Ergebnis ${year}`} value={formatCHF(kpi.net)} />
            <StatCard label="Liquidität aktuell" value={formatCHF(liquidity)} />
          </div>

          <Card title={`Monatsverlauf ${year}`}>
            <div className="flex items-end gap-2">
              {months.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-40 w-full items-end justify-center gap-0.5">
                    <div
                      className="w-3 rounded-t bg-green-500"
                      style={{ height: `${(m.income / maxMonth) * 100}%` }}
                      title={`Einnahmen ${formatCHF(m.income)}`}
                    />
                    <div
                      className="w-3 rounded-t bg-red-500"
                      style={{ height: `${(m.expense / maxMonth) * 100}%` }}
                      title={`Ausgaben ${formatCHF(m.expense)}`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{MONTHS[m.month]}</span>
                </div>
              ))}
            </div>
          </Card>

          {(orders?.length ?? 0) > 0 && margin.cogs > 0 && (
            <Card title="Marge (Shopify, mit Printful-Kosten)">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Umsatz" value={formatCHF(margin.revenue)} />
                <StatCard label="Wareneinsatz" value={formatCHF(margin.cogs)} tone="negative" />
                <StatCard
                  label="Marge"
                  value={`${formatCHF(margin.margin)} (${margin.marginPct}%)`}
                  tone="positive"
                />
              </div>
              {margin.ordersWithoutCogs > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {margin.ordersWithoutCogs} verbuchte Bestellung
                  {margin.ordersWithoutCogs === 1 ? '' : 'en'} ohne Printful-Kosten – Marge dafür
                  fehlt in dieser Auswertung.
                </p>
              )}
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Ertrag nach Konto">
              <CategoryTable lines={income} tone="green" />
            </Card>
            <Card title="Aufwand nach Konto">
              <CategoryTable lines={expense} tone="red" />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Liquidität nach Konto">
              <table className="w-full text-sm">
                <tbody>
                  {balances.map((b) => (
                    <tr key={b.account.id} className="border-b border-border/70 last:border-0">
                      <td className="py-1.5 text-muted-foreground">
                        {b.account.number} {b.account.name}
                      </td>
                      <td className="py-1.5 text-right font-medium">{formatCHF(b.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card title="Jahresvergleich">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1.5">Jahr</th>
                    <th className="py-1.5 text-right">Einnahmen</th>
                    <th className="py-1.5 text-right">Ausgaben</th>
                    <th className="py-1.5 text-right">Ergebnis</th>
                  </tr>
                </thead>
                <tbody>
                  {yearComparison.map(([y, v]) => (
                    <tr key={y} className="border-b border-border/70 last:border-0">
                      <td className="py-1.5 font-medium">{y}</td>
                      <td className="py-1.5 text-right text-success tabular-nums">{formatCHF(v.inc)}</td>
                      <td className="py-1.5 text-right text-destructive tabular-nums">{formatCHF(v.exp)}</td>
                      <td className="py-1.5 text-right font-medium">{formatCHF(v.inc - v.exp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Top-Kunden">
              {customers.length === 0 ? (
                <EmptyState compact title="Keine Daten" />
              ) : (
                <TableWrap>
                  <table className="w-full text-sm">
                    <tbody>
                      {customers.map((c) => (
                        <tr key={c.name} className="border-b border-border/70 last:border-0">
                          <td className="py-1.5">
                            {c.contactId ? (
                              <Link to={`/kunden/${c.contactId}`} className="hover:underline">
                                {c.name}
                              </Link>
                            ) : (
                              c.name
                            )}
                            <span className="ml-2 text-xs text-muted-foreground">{c.orders}×</span>
                          </td>
                          <td className="py-1.5 text-right font-medium">{formatCHF(c.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </Card>

            <Card title="Rabatte (Shopify)">
              {discounts.length === 0 ? (
                <EmptyState compact title="Keine Rabatte verwendet" />
              ) : (
                <TableWrap>
                  <table className="w-full text-sm">
                    <tbody>
                      {discounts.map((d) => (
                        <tr key={d.code} className="border-b border-border/70 last:border-0">
                          <td className="py-1.5">
                            {d.code}
                            <span className="ml-2 text-xs text-muted-foreground">{d.count}×</span>
                          </td>
                          <td className="py-1.5 text-right font-medium tabular-nums text-warning">
                            −{formatCHF(d.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </Card>

            <Card title="Top-Produkte (Shopify)">
              {products.length === 0 ? (
                <EmptyState compact title="Keine Daten" />
              ) : (
                <TableWrap>
                  <table className="w-full text-sm">
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.title} className="border-b border-border/70 last:border-0">
                          <td className="py-1.5">
                            {p.title}
                            <span className="ml-2 text-xs text-muted-foreground">{p.quantity} Stk</span>
                          </td>
                          <td className="py-1.5 text-right font-medium">{formatCHF(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </Card>

            <Card title="Kunden-Reaktivierung">
              {reactivation.length === 0 ? (
                <EmptyState compact title="Keine Kandidaten" description="Alle Kunden haben kürzlich bestellt." />
              ) : (
                <TableWrap>
                  <table className="w-full text-sm">
                    <tbody>
                      {reactivation.map((r) => (
                        <tr key={r.name} className="border-b border-border/70 last:border-0">
                          <td className="py-1.5">
                            {r.contactId ? (
                              <Link to={`/kunden/${r.contactId}`} className="hover:underline">
                                {r.name}
                              </Link>
                            ) : (
                              r.name
                            )}
                            <span className="ml-2 text-xs text-muted-foreground">
                              {r.totalOrders}× bisher
                            </span>
                          </td>
                          <td className="py-1.5 text-right text-muted-foreground tabular-nums">
                            vor {r.daysSince} Tagen
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </Card>
          </div>

          <Card title="Rabattaktion simulieren">
            <p className="mb-3 text-xs text-muted-foreground">
              Grobe Schätzung auf Basis von Durchschnittswerten, keine Prognose.
            </p>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Rabatt %">
                <Input
                  type="number"
                  step="1"
                  className="no-spin"
                  value={discountPct}
                  onChange={(e) => setDiscountPct(Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Bestellungen (Aktion)">
                <Input
                  type="number"
                  step="1"
                  className="no-spin"
                  value={expectedOrders}
                  onChange={(e) => setExpectedOrders(Number(e.target.value) || 0)}
                />
              </Field>
              <Field
                label="Ø Marge %"
                hint={
                  avgMarginPctFromArticles != null
                    ? `Aus Artikelstamm: ${avgMarginPctFromArticles.toFixed(0)}%`
                    : 'Kein EK im Artikelstamm hinterlegt – schätzen.'
                }
              >
                <Input
                  type="number"
                  step="1"
                  className="no-spin"
                  placeholder={String(Math.round(avgMarginPctFromArticles ?? 30))}
                  value={marginPctInput}
                  onChange={(e) => setMarginPctInput(e.target.value)}
                />
              </Field>
              <Field label="Ø Bestellwert CHF" hint="Aus den letzten Bestellungen.">
                <Input value={formatCHF(avgOrderValue)} disabled />
              </Field>
            </div>

            {avgOrderValue > 0 && (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <StatCard label="Marge ohne Aktion" value={formatCHF(sim.totalMarginNormal)} />
                <StatCard
                  label="Marge mit Aktion"
                  value={formatCHF(sim.totalMarginDiscounted)}
                  tone={sim.totalMarginDiscounted >= sim.totalMarginNormal ? 'positive' : 'negative'}
                />
                <StatCard
                  label="Zusätzlich nötige Bestellungen"
                  value={
                    sim.extraOrdersNeeded != null
                      ? `+${Math.ceil(sim.extraOrdersNeeded)}`
                      : 'nicht erreichbar'
                  }
                  hint="um die gleiche Marge wie ohne Aktion zu erzielen"
                  tone={sim.extraOrdersNeeded == null ? 'negative' : undefined}
                />
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  )
}

function CategoryTable({
  lines,
  tone,
}: {
  lines: { number: string; name: string; amount: number }[]
  tone: 'green' | 'red'
}) {
  if (lines.length === 0) return <EmptyState compact title="Keine Buchungen" />
  const total = lines.reduce((s, l) => s + l.amount, 0)
  return (
    <table className="w-full text-sm">
      <tbody>
        {lines.map((l) => (
          <tr key={l.number} className="border-b border-border/70">
            <td className="py-1.5 font-mono text-xs text-muted-foreground">{l.number}</td>
            <td className="py-1.5 text-muted-foreground">{l.name}</td>
            <td className="py-1.5 text-right font-medium">{formatCHF(l.amount)}</td>
          </tr>
        ))}
        <tr>
          <td />
          <td className="py-2 font-semibold">Total</td>
          <td
            className={cn(
              'py-2 text-right font-semibold tabular-nums',
              tone === 'green' ? 'text-success' : 'text-destructive',
            )}
          >
            {formatCHF(total)}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
