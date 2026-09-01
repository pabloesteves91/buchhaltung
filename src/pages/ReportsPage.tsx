import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, EmptyState, Select, TableWrap } from '@/components/ui'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { useDocuments } from '@/hooks/useDocuments'
import { useShopifyOrders } from '@/hooks/useShopify'
import {
  accountBalances,
  byCategory,
  discountUsage,
  downloadCsv,
  monthlyBuckets,
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
            <Card>
              <p className="text-xs text-slate-500">Einnahmen {year}</p>
              <p className="mt-1 text-xl font-bold text-green-600">{formatCHF(kpi.inc)}</p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">Ausgaben {year}</p>
              <p className="mt-1 text-xl font-bold text-red-600">{formatCHF(kpi.exp)}</p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">Ergebnis {year}</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{formatCHF(kpi.net)}</p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">Liquidität aktuell</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{formatCHF(liquidity)}</p>
            </Card>
          </div>

          <Card title={`Monatsverlauf ${year}`}>
            <div className="flex items-end gap-2">
              {months.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-40 w-full items-end justify-center gap-0.5">
                    <div
                      className="w-3 rounded-t bg-green-400"
                      style={{ height: `${(m.income / maxMonth) * 100}%` }}
                      title={`Einnahmen ${formatCHF(m.income)}`}
                    />
                    <div
                      className="w-3 rounded-t bg-red-400"
                      style={{ height: `${(m.expense / maxMonth) * 100}%` }}
                      title={`Ausgaben ${formatCHF(m.expense)}`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">{MONTHS[m.month]}</span>
                </div>
              ))}
            </div>
          </Card>

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
                    <tr key={b.account.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-1.5 text-slate-600">
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
                  <tr className="text-left text-xs text-slate-400">
                    <th className="py-1.5">Jahr</th>
                    <th className="py-1.5 text-right">Einnahmen</th>
                    <th className="py-1.5 text-right">Ausgaben</th>
                    <th className="py-1.5 text-right">Ergebnis</th>
                  </tr>
                </thead>
                <tbody>
                  {yearComparison.map(([y, v]) => (
                    <tr key={y} className="border-b border-slate-50 last:border-0">
                      <td className="py-1.5 font-medium">{y}</td>
                      <td className="py-1.5 text-right text-green-600">{formatCHF(v.inc)}</td>
                      <td className="py-1.5 text-right text-red-600">{formatCHF(v.exp)}</td>
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
                <p className="py-3 text-sm text-slate-400">Keine Daten.</p>
              ) : (
                <TableWrap>
                  <table className="w-full text-sm">
                    <tbody>
                      {customers.map((c) => (
                        <tr key={c.name} className="border-b border-slate-50 last:border-0">
                          <td className="py-1.5">
                            {c.contactId ? (
                              <Link to={`/kunden/${c.contactId}`} className="hover:underline">
                                {c.name}
                              </Link>
                            ) : (
                              c.name
                            )}
                            <span className="ml-2 text-xs text-slate-400">{c.orders}×</span>
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
                <p className="py-3 text-sm text-slate-400">Keine Rabatte verwendet.</p>
              ) : (
                <TableWrap>
                  <table className="w-full text-sm">
                    <tbody>
                      {discounts.map((d) => (
                        <tr key={d.code} className="border-b border-slate-50 last:border-0">
                          <td className="py-1.5">
                            {d.code}
                            <span className="ml-2 text-xs text-slate-400">{d.count}×</span>
                          </td>
                          <td className="py-1.5 text-right font-medium text-amber-600">
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
                <p className="py-3 text-sm text-slate-400">Keine Daten.</p>
              ) : (
                <TableWrap>
                  <table className="w-full text-sm">
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.title} className="border-b border-slate-50 last:border-0">
                          <td className="py-1.5">
                            {p.title}
                            <span className="ml-2 text-xs text-slate-400">{p.quantity} Stk</span>
                          </td>
                          <td className="py-1.5 text-right font-medium">{formatCHF(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </Card>
          </div>
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
  if (lines.length === 0) return <p className="py-3 text-sm text-slate-400">Keine Buchungen.</p>
  const total = lines.reduce((s, l) => s + l.amount, 0)
  return (
    <table className="w-full text-sm">
      <tbody>
        {lines.map((l) => (
          <tr key={l.number} className="border-b border-slate-50">
            <td className="py-1.5 font-mono text-xs text-slate-400">{l.number}</td>
            <td className="py-1.5 text-slate-600">{l.name}</td>
            <td className="py-1.5 text-right font-medium">{formatCHF(l.amount)}</td>
          </tr>
        ))}
        <tr>
          <td />
          <td className="py-2 font-semibold">Total</td>
          <td className={`py-2 text-right font-semibold ${tone === 'green' ? 'text-green-600' : 'text-red-600'}`}>
            {formatCHF(total)}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
