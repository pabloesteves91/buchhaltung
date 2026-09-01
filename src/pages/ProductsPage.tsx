import { useMemo, useState } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, Field, Input, TableWrap } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  useCreateProduct,
  useDeleteProduct,
  useProducts,
  useUpdateProduct,
} from '@/hooks/useProducts'
import { useShopifyActions } from '@/hooks/useShopify'
import { round2 } from '@/lib/format'

export function ProductsPage() {
  const { data: products, isLoading } = useProducts()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()
  const { importProducts } = useShopifyActions()

  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ title: '', sku: '', price: '', unit: 'Stk' })
  const [msg, setMsg] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = products ?? []
    if (!q) return list
    return list.filter((p) => `${p.title} ${p.sku ?? ''}`.toLowerCase().includes(q))
  }, [products, search])

  const shopifyCount = (products ?? []).filter((p) => p.source === 'shopify').length

  async function addManual(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    await createProduct.mutateAsync({
      source: 'manual',
      title: form.title.trim(),
      sku: form.sku.trim() || undefined,
      price: round2(Number(form.price)),
      unit: form.unit.trim() || 'Stk',
      active: true,
    })
    setForm({ title: '', sku: '', price: '', unit: 'Stk' })
    setShowNew(false)
  }

  async function runImport() {
    setMsg(null)
    try {
      const r = await importProducts.mutateAsync({})
      setMsg(`${r.created} neue Artikel, ${r.updated} aktualisiert.`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Import fehlgeschlagen.')
    }
  }

  return (
    <>
      <PageHeader
        title="Artikel"
        subtitle="Produkte für Offerten und Rechnungen – aus Shopify oder selbst angelegt."
        actions={
          <>
            <Button variant="secondary" onClick={runImport} disabled={importProducts.isPending}>
              <RefreshCw className={cn('size-4', importProducts.isPending && 'animate-spin')} />
              Aus Shopify importieren
            </Button>
            <Button onClick={() => setShowNew((v) => !v)}>
              <Plus className="size-4" /> Artikel
            </Button>
          </>
        }
      />

      {msg && <p className="mb-4 text-sm text-slate-600">{msg}</p>}

      {showNew && (
        <Card title="Neuer Artikel" className="mb-4">
          <form onSubmit={addManual} className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Field label="Bezeichnung">
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="z.B. Design-Pauschale"
                />
              </Field>
            </div>
            <Field label="Artikelnr. / SKU">
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Preis CHF">
                <Input
                  type="number"
                  step="0.05"
                  className="no-spin"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </Field>
              <Field label="Einheit">
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </Field>
            </div>
            <div className="sm:col-span-4 flex gap-2">
              <Button type="submit">Speichern</Button>
              <Button type="button" variant="ghost" onClick={() => setShowNew(false)}>
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      )}

      {(products?.length ?? 0) > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            placeholder="Suchen …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <span className="text-xs text-slate-400">
            {products?.length} Artikel · {shopifyCount} aus Shopify
          </span>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400">Laden …</p>
      ) : (products?.length ?? 0) === 0 ? (
        <EmptyState
          title="Noch keine Artikel"
          description="Importiere deine Shopify-Produkte oder lege einen Artikel manuell an."
          action={<Button onClick={runImport}>Aus Shopify importieren</Button>}
        />
      ) : (
        <Card>
          <TableWrap>
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="py-2">Bezeichnung</th>
                  <th className="py-2">SKU</th>
                  <th className="py-2 w-28 text-right">Preis CHF</th>
                  <th className="py-2 w-20">Einheit</th>
                  <th className="py-2">Quelle</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className={cn('border-b border-slate-50 last:border-0', !p.active && 'opacity-40')}>
                    <td className="py-1.5">{p.title}</td>
                    <td className="py-1.5 text-slate-400">{p.sku || '–'}</td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        step="0.05"
                        defaultValue={p.price}
                        className="no-spin w-24 rounded border border-slate-200 px-2 py-1 text-right"
                        onBlur={(e) => {
                          const v = round2(Number(e.target.value))
                          if (v !== p.price) updateProduct.mutate({ id: p.id, price: v })
                        }}
                      />
                    </td>
                    <td className="py-1.5">
                      <input
                        defaultValue={p.unit}
                        className="w-16 rounded border border-slate-200 px-2 py-1"
                        onBlur={(e) => {
                          if (e.target.value !== p.unit)
                            updateProduct.mutate({ id: p.id, unit: e.target.value })
                        }}
                      />
                    </td>
                    <td className="py-1.5">
                      <Badge tone={p.source === 'shopify' ? 'blue' : 'slate'}>
                        {p.source === 'shopify' ? 'Shopify' : 'Manuell'}
                      </Badge>
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        className="text-xs text-slate-400 hover:text-brand-600"
                        onClick={() => updateProduct.mutate({ id: p.id, active: !p.active })}
                      >
                        {p.active ? 'Ausblenden' : 'Einblenden'}
                      </button>
                      {p.source === 'manual' && (
                        <button
                          className="ml-2 text-slate-300 hover:text-red-600"
                          onClick={() => {
                            if (confirm(`Artikel „${p.title}“ löschen?`)) deleteProduct.mutate(p.id)
                          }}
                        >
                          <Trash2 className="inline size-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <p className="mt-2 text-xs text-slate-400">
            Preis anpassen: Feld ändern und wegklicken. Preise gelten für neue Offerten/Rechnungen –
            bestehende Dokumente bleiben unverändert.
          </p>
        </Card>
      )}
    </>
  )
}
