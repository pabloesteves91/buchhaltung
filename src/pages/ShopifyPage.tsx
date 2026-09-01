import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, RefreshCw, Store, Upload } from 'lucide-react'
import { importShopifyOrdersCsv } from '@/lib/shopifyCsv'
import { bookShopifyOrderLocal, unbookShopifyOrderLocal } from '@/lib/shopifyBooking'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, Field, Input, Select, TableWrap } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAccounts } from '@/hooks/useAccounts'
import {
  useSaveShopifyConfig,
  useShopifyActions,
  useShopifyConfig,
  useShopifyOrders,
  type ShopifyBookingStatus,
} from '@/hooks/useShopify'
import { formatCHF, formatDate } from '@/lib/format'

function friendlyError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e)
  if (message === 'internal' || message.includes('CORS') || message.includes('blockiert')) {
    return 'Cloud Function nicht erreichbar. Ist der letzte Deploy schon durch (Actions-Tab in GitHub)?'
  }
  return message
}

const STATUS: Record<ShopifyBookingStatus, { label: string; tone: 'slate' | 'green' | 'amber' | 'red' | 'blue' }> = {
  open: { label: 'Nicht verbucht', tone: 'amber' },
  booked: { label: 'Verbucht', tone: 'green' },
  cancelled: { label: 'Storniert', tone: 'slate' },
  refunded: { label: 'Retoure verbucht', tone: 'blue' },
  refund_pending: { label: 'Retoure offen', tone: 'red' },
}

const FILTERS: { key: ShopifyBookingStatus | 'all'; label: string }[] = [
  { key: 'open', label: 'Nicht verbucht' },
  { key: 'booked', label: 'Verbucht' },
  { key: 'refund_pending', label: 'Retouren' },
  { key: 'cancelled', label: 'Storniert' },
  { key: 'all', label: 'Alle' },
]

export function ShopifyPage() {
  const { config, loading } = useShopifyConfig()
  const saveConfig = useSaveShopifyConfig()
  const { data: accounts } = useAccounts()
  const { data: orders } = useShopifyOrders()
  const { test, importOrders, registerWebhooks } = useShopifyActions()

  const qc = useQueryClient()
  const csvInput = useRef<HTMLInputElement>(null)
  const [csvBusy, setCsvBusy] = useState(false)
  const [filter, setFilter] = useState<ShopifyBookingStatus | 'all'>('open')
  const [sinceDays, setSinceDays] = useState(90)
  const [form, setForm] = useState({ shopDomain: '', clientId: '', clientSecret: '' })
  const [msg, setMsg] = useState<string | null>(null)

  async function handleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvBusy(true)
    setMsg(null)
    try {
      const text = await file.text()
      const r = await importShopifyOrdersCsv(text, { createContacts: cfg.createContacts ?? true })
      qc.invalidateQueries({ queryKey: ['shopifyOrders'] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setMsg(
        `${r.imported} Bestellungen importiert, ${r.skipped} übersprungen (schon vorhanden), ${r.contactsCreated} neue Kunden.`,
      )
    } catch (err) {
      setMsg(friendlyError(err))
    } finally {
      setCsvBusy(false)
      if (csvInput.current) csvInput.current.value = ''
    }
  }

  const cfg = config ?? {}

  const book = useMutation({
    mutationFn: async (ids: string[]) => {
      const list = orders ?? []
      for (const id of ids) {
        const o = list.find((x) => x.orderId === id || x.id === id)
        if (o) await bookShopifyOrderLocal(o, cfg)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopifyOrders'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
    onError: (e) => setMsg(friendlyError(e)),
  })
  const unbook = useMutation({
    mutationFn: async (orderKey: string) => {
      const o = (orders ?? []).find((x) => x.orderId === orderKey || x.id === orderKey)
      if (o) await unbookShopifyOrderLocal(o)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopifyOrders'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })

  const revenueAccounts = (accounts ?? []).filter((a) => a.type === 'ertrag' && a.active)
  const moneyAccounts = (accounts ?? []).filter((a) => a.type === 'aktiven' && a.active)
  const expenseAccounts = (accounts ?? []).filter((a) => a.type === 'aufwand' && a.active)

  const filtered = useMemo(() => {
    const list = orders ?? []
    if (filter === 'all') return list
    if (filter === 'refund_pending')
      return list.filter((o) => o.bookingStatus === 'refund_pending' || o.bookingStatus === 'refunded')
    return list.filter((o) => o.bookingStatus === filter)
  }, [orders, filter])

  const openCount = (orders ?? []).filter((o) => o.bookingStatus === 'open').length

  function accountField(
    label: string,
    key: 'revenueId' | 'shippingId' | 'feeId' | 'moneyId' | 'refundId',
    list: typeof revenueAccounts,
  ) {
    return (
      <Field label={label}>
        <Select
          value={cfg.accounts?.[key] ?? ''}
          onChange={(e) =>
            saveConfig.mutate({ accounts: { ...cfg.accounts, [key]: e.target.value } })
          }
        >
          <option value="">– wählen –</option>
          {list.map((a) => (
            <option key={a.id} value={a.id}>
              {a.number} {a.name}
            </option>
          ))}
        </Select>
      </Field>
    )
  }

  async function runTest() {
    setMsg(null)
    try {
      const r = await test.mutateAsync({})
      setMsg(`Verbunden mit „${r.name}“ (${r.currency}).`)
    } catch (e) {
      setMsg(friendlyError(e))
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Laden …</p>

  const isConfigured = Boolean(cfg.shopDomain && cfg.clientId && cfg.clientSecret)

  return (
    <>
      <PageHeader
        title="Shopify"
        subtitle="Bestellungen als Umsatz verbuchen, Kunden übernehmen, Retouren erfassen."
      />

      {/* Connection */}
      <Card title="Verbindung" className="mb-6">
        {isConfigured ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge tone={cfg.connected ? 'green' : 'amber'}>
                {cfg.connected ? (
                  <>
                    <CheckCircle2 className="mr-1 inline size-3.5" />
                    {cfg.shopName || cfg.shopDomain}
                  </>
                ) : (
                  'Nicht getestet'
                )}
              </Badge>
              {cfg.lastImportAt && (
                <span className="text-slate-500">
                  Letzter Import: {formatDate(cfg.lastImportAt.slice(0, 10))}
                </span>
              )}
              {cfg.webhookIds && cfg.webhookIds.length > 0 && (
                <Badge tone="blue">Automatik aktiv ({cfg.webhookIds.length} Webhooks)</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={runTest} disabled={test.isPending}>
                {test.isPending ? 'Teste …' : 'Verbindung testen'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => saveConfig.mutate({ shopDomain: '', clientId: '', clientSecret: '' })}
              >
                Zugang ändern
              </Button>
            </div>
            {msg && <p className="text-sm text-slate-600">{msg}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Im Shopify <em>Dev Dashboard</em> deine App öffnen → <em>App-Einstellungen</em> →
              Abschnitt <em>Anmeldedaten</em>. Client-ID kopieren, beim Schlüssel aufs Auge klicken
              und kopieren. Die App muss auf deinem Shop installiert sein, mit Zugriff auf
              Bestellungen, Kunden und Produkte.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Shop-Domain">
                <Input
                  placeholder="deinshop.myshopify.com"
                  value={form.shopDomain}
                  onChange={(e) => setForm({ ...form, shopDomain: e.target.value })}
                />
              </Field>
              <Field label="Client-ID">
                <Input
                  placeholder="cbc51fe1c98b…"
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                />
              </Field>
              <Field label="Client-Secret (Schlüssel)" hint="Wird auch für die Webhook-Signatur verwendet.">
                <Input
                  placeholder="shpss_…"
                  value={form.clientSecret}
                  onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                />
              </Field>
            </div>
            <Button
              onClick={() =>
                saveConfig.mutate({
                  shopDomain: form.shopDomain.trim(),
                  clientId: form.clientId.trim(),
                  clientSecret: form.clientSecret.trim(),
                  apiVersion: '2025-01',
                  createContacts: true,
                })
              }
              disabled={!form.shopDomain || !form.clientId || !form.clientSecret}
            >
              Speichern
            </Button>
          </div>
        )}
      </Card>

      {/* CSV import — works without any API setup */}
      <Card title="Import aus CSV" className="mb-6">
        <p className="text-sm text-slate-500">
          Alternative ohne API: in Shopify unter <em>Bestellungen → Exportieren</em> eine CSV
          herunterladen und hier hochladen. Doppelte werden automatisch übersprungen.
        </p>
        <input
          ref={csvInput}
          type="file"
          accept=".csv,text/csv"
          onChange={handleCsv}
          className="hidden"
        />
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => csvInput.current?.click()}
          disabled={csvBusy}
        >
          <Upload className="size-4" />
          {csvBusy ? 'Importiere …' : 'CSV hochladen'}
        </Button>
        {msg && !isConfigured && <p className="mt-3 text-sm text-slate-600">{msg}</p>}
      </Card>

      {(isConfigured || (orders?.length ?? 0) > 0) && (
        <>
          {/* Account mapping */}
          <Card title="Kontozuordnung" className="mb-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {accountField('Warenerlös', 'revenueId', revenueAccounts)}
              {accountField('Versandertrag', 'shippingId', revenueAccounts)}
              {accountField('Geldkonto (Zahlungseingang)', 'moneyId', moneyAccounts)}
              {accountField('Rückerstattungen', 'refundId', revenueAccounts)}
              {accountField('Shopify-Gebühren', 'feeId', expenseAccounts)}
            </div>
            <div className="mt-4 space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={cfg.createContacts ?? true}
                  onChange={(e) => saveConfig.mutate({ createContacts: e.target.checked })}
                />
                Kunden aus Bestellungen automatisch in den Kundenstamm übernehmen
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={cfg.autoBook ?? false}
                  onChange={(e) => saveConfig.mutate({ autoBook: e.target.checked })}
                />
                Neue Bestellungen automatisch verbuchen (via Webhooks)
              </label>
            </div>
          </Card>

          {/* Actions */}
          {isConfigured && (
          <Card title="Import & Automatik" className="mb-6">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Zeitraum">
                <Select
                  value={sinceDays}
                  onChange={(e) => setSinceDays(Number(e.target.value))}
                  className="w-40"
                >
                  <option value={30}>Letzte 30 Tage</option>
                  <option value={90}>Letzte 90 Tage</option>
                  <option value={365}>Letztes Jahr</option>
                  <option value={730}>Letzte 2 Jahre</option>
                </Select>
              </Field>
              <Button
                onClick={async () => {
                  setMsg(null)
                  try {
                    const r = await importOrders.mutateAsync({ sinceDays })
                    setMsg(`${r.imported} Bestellungen importiert.`)
                  } catch (e) {
                    setMsg(friendlyError(e))
                  }
                }}
                disabled={importOrders.isPending}
              >
                <RefreshCw className={cn('size-4', importOrders.isPending && 'animate-spin')} />
                Bestellungen importieren
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  setMsg(null)
                  try {
                    const r = await registerWebhooks.mutateAsync({})
                    setMsg(`${r.registered} Webhooks registriert – neue Bestellungen kommen jetzt automatisch.`)
                  } catch (e) {
                    setMsg(friendlyError(e))
                  }
                }}
                disabled={registerWebhooks.isPending}
              >
                Webhooks registrieren
              </Button>
            </div>
            {msg && <p className="mt-3 text-sm text-slate-600">{msg}</p>}
          </Card>
          )}

          {/* Orders */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium',
                    filter === f.key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {openCount > 0 && (
              <Button
                size="sm"
                onClick={() =>
                  book.mutate(
                    (orders ?? [])
                      .filter((o) => o.bookingStatus === 'open')
                      .map((o) => o.orderId),
                  )
                }
                disabled={book.isPending}
              >
                Alle {openCount} verbuchen
              </Button>
            )}
          </div>

          {(orders?.length ?? 0) === 0 ? (
            <EmptyState
              title="Noch keine Bestellungen"
              description="Importiere die bisherigen Bestellungen oder registriere die Webhooks für den Automatik-Betrieb."
              action={
                <Button onClick={() => importOrders.mutate({ sinceDays })}>
                  <Store className="size-4" /> Jetzt importieren
                </Button>
              }
            />
          ) : (
            <Card>
              <TableWrap>
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                      <th className="py-2">Bestellung</th>
                      <th className="py-2">Datum</th>
                      <th className="py-2">Kunde</th>
                      <th className="py-2 text-right">Betrag</th>
                      <th className="py-2 text-right">Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((o) => (
                      <tr key={o.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 font-medium text-slate-700">{o.orderName}</td>
                        <td className="py-2 whitespace-nowrap text-slate-500">{formatDate(o.date)}</td>
                        <td className="py-2 text-slate-600">
                          {o.customerName}
                          {o.contactId && (
                            <Link
                              to="/kunden"
                              className="ml-2 text-xs text-brand-600 hover:underline"
                            >
                              im Stamm
                            </Link>
                          )}
                        </td>
                        <td className="py-2 text-right">{formatCHF(o.total)}</td>
                        <td className="py-2 text-right">
                          <Badge tone={STATUS[o.bookingStatus].tone}>
                            {STATUS[o.bookingStatus].label}
                          </Badge>
                        </td>
                        <td className="py-2 text-right">
                          {o.bookingStatus === 'open' && (
                            <button
                              className="text-xs font-medium text-brand-600 hover:underline"
                              onClick={() => book.mutate([o.orderId])}
                            >
                              Verbuchen
                            </button>
                          )}
                          {o.bookingStatus === 'booked' && (
                            <button
                              className="text-xs text-slate-400 hover:text-red-600"
                              onClick={() => unbook.mutate(o.orderId)}
                            >
                              Rückgängig
                            </button>
                          )}
                          {o.bookingStatus === 'refund_pending' && (
                            <span className="text-xs text-red-600">
                              −{formatCHF(o.pendingRefund ?? 0)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Card>
          )}
        </>
      )}
    </>
  )
}
