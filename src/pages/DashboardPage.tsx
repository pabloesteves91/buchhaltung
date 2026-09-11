import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, LayoutGrid } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, Skeleton, TableWrap } from '@/components/ui'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DataTable, Td, Th, Tr } from '@/components/DataTable'
import { StatCard } from '@/components/StatCard'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { useDocuments } from '@/hooks/useDocuments'
import { useFiscalYears } from '@/hooks/useFiscalYears'
import { useSaveSettings, useSettings } from '@/hooks/useSettings'
import { SHOPIFY_STATUS, useShopifyOrders, type ShopifyOrderDoc } from '@/hooks/useShopify'
import { isOverdue } from '@/lib/dunning'
import { amountPaid } from '@/lib/documentTotals'
import { formatCHF, formatDate, todayIso } from '@/lib/format'

/** "Cap 10×, +1 weitere" — a compact summary of an order's line items. */
function productSummary(items: ShopifyOrderDoc['lineItems']): string {
  if (!items || items.length === 0) return '–'
  const [first, ...rest] = items
  const label = first.quantity > 1 ? `${first.title} ×${first.quantity}` : first.title
  return rest.length > 0 ? `${label} +${rest.length} weitere` : label
}

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

interface Widget {
  id: string
  label: string
}

const WIDGETS: Widget[] = [
  { id: 'health', label: 'Health-Check' },
  { id: 'kpi', label: 'Kennzahlen' },
  { id: 'chart', label: 'Monatsverlauf' },
  { id: 'orders', label: 'Neueste Bestellungen' },
]
const DEFAULT_WIDGET_IDS = WIDGETS.map((w) => w.id)

interface HealthItem {
  label: string
  detail: string
  to: string
}

export function DashboardPage() {
  const navigate = useNavigate()
  const year = new Date().getFullYear()
  const { data: transactions, isLoading } = useTransactions(year)
  const { data: accounts } = useAccounts()
  const { data: shopifyOrders } = useShopifyOrders()
  const { data: invoices } = useDocuments('rechnung')
  const { data: fiscalYears } = useFiscalYears()
  const { data: settings } = useSettings()
  const saveSettings = useSaveSettings()

  const openShopifyCount = (shopifyOrders ?? []).filter((o) => o.bookingStatus === 'open').length
  // useShopifyOrders() is already sorted newest-first (orderedAt desc).
  const recentOrders = (shopifyOrders ?? []).slice(0, 10)

  const overdue = useMemo(() => (invoices ?? []).filter((d) => isOverdue(d)), [invoices])
  const overdueTotal = overdue.reduce((s, d) => s + (d.total - amountPaid(d)), 0)

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

  // Health-Check: nur Probleme auflisten, gleiche Idee wie die Checkliste auf
  // der Jahresabschluss-Seite, aber hier ausgeblendet statt immer sichtbar.
  const healthChecks = useMemo<HealthItem[]>(() => {
    const checks: (HealthItem | null)[] = []

    if (overdue.length > 0) {
      checks.push({
        label: `${overdue.length} überfällige Rechnung${overdue.length === 1 ? '' : 'en'}`,
        detail: `${formatCHF(overdueTotal)} offen`,
        to: '/mahnwesen',
      })
    }
    if (openShopifyCount > 0) {
      checks.push({
        label: `${openShopifyCount} unverbuchte Shopify-Bestellung${openShopifyCount === 1 ? '' : 'en'}`,
        detail: 'Jetzt verbuchen',
        to: '/shopify',
      })
    }

    const vatThreshold = settings?.vatThresholdChf ?? 100_000
    if (vatThreshold > 0 && stats.inc / vatThreshold >= 0.8) {
      checks.push({
        label: 'MWST-Pflicht-Schwelle rückt näher',
        detail: `${formatCHF(stats.inc)} von ${formatCHF(vatThreshold)}`,
        to: '/einstellungen',
      })
    }

    // Nicht am 1. Januar nerven – erst ab Februar auf den Vorjahresabschluss hinweisen.
    const prevYear = year - 1
    const prevYearClosed = (fiscalYears ?? []).some(
      (fy) => fy.year === prevYear && fy.status === 'abgeschlossen',
    )
    if (new Date().getMonth() >= 1 && !prevYearClosed) {
      checks.push({
        label: `Jahresabschluss ${prevYear} noch offen`,
        detail: 'Abschliessen',
        to: '/abschluss',
      })
    }

    const daysSinceBackup = settings?.lastBackupAt
      ? Math.round((Date.parse(todayIso()) - Date.parse(settings.lastBackupAt)) / 86_400_000)
      : null
    if (daysSinceBackup == null || daysSinceBackup > 30) {
      checks.push({
        label: daysSinceBackup == null ? 'Noch nie gesichert' : `Backup vor ${daysSinceBackup} Tagen`,
        detail: 'Jetzt exportieren',
        to: '/einstellungen',
      })
    }

    return checks.filter((c): c is HealthItem => c !== null)
  }, [overdue, overdueTotal, openShopifyCount, settings, stats.inc, fiscalYears, year])

  const needsSetup = (accounts?.length ?? 0) === 0

  const visibleWidgets = new Set(settings?.dashboardWidgets ?? DEFAULT_WIDGET_IDS)
  function toggleWidget(id: string) {
    if (!settings) return
    const current = settings.dashboardWidgets ?? DEFAULT_WIDGET_IDS
    const next = current.includes(id) ? current.filter((w) => w !== id) : [...current, id]
    saveSettings.mutate({ ...settings, dashboardWidgets: next })
  }

  return (
    <>
      <PageHeader
        title="Übersicht"
        subtitle={`Geschäftsjahr ${year}`}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm">
                <LayoutGrid className="size-4" /> Widgets
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sichtbare Widgets</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {WIDGETS.map((w) => (
                <DropdownMenuCheckboxItem
                  key={w.id}
                  checked={visibleWidgets.has(w.id)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => toggleWidget(w.id)}
                >
                  {w.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {needsSetup ? (
        <EmptyState
          title="Willkommen bei der nipponnites-Buchhaltung"
          description="Lade zuerst den Kontenrahmen KMU unter „Kontenplan“ und hinterlege deine Firmendaten unter „Einstellungen“."
        />
      ) : (
        <div className="space-y-6">
          {visibleWidgets.has('health') && (
            <Card title="Health-Check">
              {healthChecks.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="size-4 shrink-0" /> Alles im grünen Bereich.
                </div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {healthChecks.map((c) => (
                    <li key={c.label} className="flex items-center gap-2">
                      <AlertTriangle className="size-4 shrink-0 text-warning" />
                      <span className="flex-1 text-foreground">{c.label}</span>
                      <button
                        onClick={() => navigate(c.to)}
                        className="text-xs font-medium text-brand-600 hover:underline"
                      >
                        {c.detail} →
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {visibleWidgets.has('kpi') && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Einnahmen" value={formatCHF(stats.inc)} tone="positive" />
              <StatCard label="Ausgaben" value={formatCHF(stats.exp)} tone="negative" />
              <StatCard label="Ergebnis" value={formatCHF(stats.net)} />
            </div>
          )}

          {visibleWidgets.has('chart') && (
            <Card title="Einnahmen und Ausgaben pro Monat">
              {isLoading ? (
                <div className="flex h-40 items-end gap-2">
                  {MONTHS.map((_, i) => (
                    <Skeleton
                      key={i}
                      className="flex-1"
                      style={{ height: `${20 + ((i * 37) % 70)}%` }}
                    />
                  ))}
                </div>
              ) : stats.inc === 0 && stats.exp === 0 ? (
                <EmptyState compact title="Noch keine Buchungen in diesem Jahr" />
              ) : (
                <div className="flex items-end gap-2">
                  {stats.monthly.map((m, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex h-40 w-full items-end justify-center gap-0.5">
                        <div
                          className="w-3 rounded-t bg-green-500"
                          style={{ height: `${(m.inc / stats.max) * 100}%` }}
                          title={`Einnahmen ${formatCHF(m.inc)}`}
                        />
                        <div
                          className="w-3 rounded-t bg-red-500"
                          style={{ height: `${(m.exp / stats.max) * 100}%` }}
                          title={`Ausgaben ${formatCHF(m.exp)}`}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{MONTHS[i]}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {visibleWidgets.has('orders') && recentOrders.length > 0 && (
            <Card title="Neueste Bestellungen">
              <TableWrap>
                <DataTable
                  minWidth={480}
                  head={
                    <>
                      <Th>Bestellung</Th>
                      <Th>Produkt</Th>
                      <Th align="right">Betrag</Th>
                      <Th align="right">Status</Th>
                    </>
                  }
                >
                  {recentOrders.map((o) => (
                    <Tr key={o.id} interactive onClick={() => navigate(`/shopify/bestellung/${o.id}`)}>
                      <Td className="font-medium text-foreground">
                        {o.orderName}
                        <span className="ml-2 text-xs text-muted-foreground">{formatDate(o.date)}</span>
                      </Td>
                      <Td className="text-muted-foreground">{productSummary(o.lineItems)}</Td>
                      <Td align="right" className="font-medium">
                        {formatCHF(o.total)}
                      </Td>
                      <Td align="right">
                        <Badge tone={SHOPIFY_STATUS[o.bookingStatus].tone}>
                          {SHOPIFY_STATUS[o.bookingStatus].label}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </DataTable>
              </TableWrap>
            </Card>
          )}
        </div>
      )}
    </>
  )
}
