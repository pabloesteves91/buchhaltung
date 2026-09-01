import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, EmptyState } from '@/components/ui'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { useShopifyOrders } from '@/hooks/useShopify'
import { formatCHF } from '@/lib/format'

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

export function DashboardPage() {
  const year = new Date().getFullYear()
  const { data: transactions, isLoading } = useTransactions(year)
  const { data: accounts } = useAccounts()
  const { data: shopifyOrders } = useShopifyOrders()
  const openShopifyCount = (shopifyOrders ?? []).filter((o) => o.bookingStatus === 'open').length

  const stats = useMemo(() => {
    const monthly = MONTHS.map(() => ({ inc: 0, exp: 0 }))
    let inc = 0
    let exp = 0
    for (const t of transactions ?? []) {
      const m = Number(t.date.slice(5, 7)) - 1
      if (t.kind === 'einnahme') {
        inc += t.amount
        monthly[m].inc += t.amount
      } else if (t.kind === 'ausgabe') {
        exp += t.amount
        monthly[m].exp += t.amount
      }
    }
    const max = Math.max(1, ...monthly.flatMap((x) => [x.inc, x.exp]))
    return { monthly, inc, exp, net: inc - exp, max }
  }, [transactions])

  const needsSetup = (accounts?.length ?? 0) === 0

  return (
    <>
      <PageHeader title="Übersicht" subtitle={`Geschäftsjahr ${year}`} />

      {needsSetup ? (
        <EmptyState
          title="Willkommen bei der nipponnites-Buchhaltung"
          description="Lade zuerst den Kontenrahmen KMU unter „Kontenplan“ und hinterlege deine Firmendaten unter „Einstellungen“."
        />
      ) : (
        <div className="space-y-6">
          {openShopifyCount > 0 && (
            <Link
              to="/shopify"
              className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 hover:bg-amber-100"
            >
              <ShoppingBag className="size-4 shrink-0" />
              {openShopifyCount} Shopify-Bestellung{openShopifyCount === 1 ? '' : 'en'} noch nicht
              verbucht →
            </Link>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-xs text-slate-500">Einnahmen</p>
              <p className="mt-1 text-2xl font-bold text-green-600">{formatCHF(stats.inc)}</p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">Ausgaben</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{formatCHF(stats.exp)}</p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">Ergebnis</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{formatCHF(stats.net)}</p>
            </Card>
          </div>

          <Card title="Einnahmen und Ausgaben pro Monat">
            {isLoading ? (
              <p className="text-sm text-slate-400">Laden …</p>
            ) : stats.inc === 0 && stats.exp === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                Noch keine Buchungen in diesem Jahr.
              </p>
            ) : (
              <div className="flex items-end gap-2">
                {stats.monthly.map((m, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex h-40 w-full items-end justify-center gap-0.5">
                      <div
                        className="w-3 rounded-t bg-green-400"
                        style={{ height: `${(m.inc / stats.max) * 100}%` }}
                        title={`Einnahmen ${formatCHF(m.inc)}`}
                      />
                      <div
                        className="w-3 rounded-t bg-red-400"
                        style={{ height: `${(m.exp / stats.max) * 100}%` }}
                        title={`Ausgaben ${formatCHF(m.exp)}`}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">{MONTHS[i]}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  )
}
