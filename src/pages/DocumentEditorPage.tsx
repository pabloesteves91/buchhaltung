import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PDFViewer } from '@react-pdf/renderer'
import { ArrowLeft, Download, Mail, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { contactName, useContacts } from '@/hooks/useContacts'
import { useSettings } from '@/hooks/useSettings'
import {
  DOCUMENT_TYPE_LABEL,
  nextDocumentNumber,
  useCreateDocument,
  useDeleteDocument,
  useDocument,
  useUpdateDocument,
} from '@/hooks/useDocuments'
import { useAccounts } from '@/hooks/useAccounts'
import { useProducts } from '@/hooks/useProducts'
import { useCreateTransaction } from '@/hooks/useTransactions'
import {
  amountPaid,
  computeTotals,
  newDiscount,
  newLineItem,
  openAmount,
} from '@/lib/documentTotals'
import { DocumentPdf } from '@/pdf/DocumentPdf'
import { buildQrBillPng } from '@/pdf/qrBill'
import { downloadDocumentPdf, emailDocument } from '@/pdf/pdfActions'
import { fiscalYearOf, formatCHF, round2, todayIso } from '@/lib/format'
import type {
  BusinessDocument,
  Contact,
  DocumentDiscount,
  DocumentStatus,
  DocumentType,
  LineItem,
  Payment,
} from '@/lib/types'

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function recipientFromContact(c: Contact): BusinessDocument['recipientSnapshot'] {
  return {
    name: contactName(c),
    address: [
      c.address.line1,
      c.address.line2,
      `${c.address.zip ?? ''} ${c.address.city ?? ''}`.trim(),
      c.address.country && c.address.country !== 'CH' ? c.address.country : '',
    ].filter(Boolean) as string[],
    street: c.address.line1,
    zip: c.address.zip,
    city: c.address.city,
    country: c.address.country || 'CH',
    email: c.email,
    language: c.language,
  }
}

interface EditorState {
  type: DocumentType
  contactId: string
  recipientSnapshot: BusinessDocument['recipientSnapshot']
  date: string
  dueDate: string
  lineItems: LineItem[]
  globalDiscountPct: number
  discounts: DocumentDiscount[]
  shipping: number
  introText: string
  outroText: string
  note: string
  status: DocumentStatus
}

const STATUS_LABEL: Record<DocumentStatus, string> = {
  entwurf: 'Entwurf',
  versendet: 'Versendet',
  teilbezahlt: 'Teilbezahlt',
  bezahlt: 'Bezahlt',
  ueberfaellig: 'Überfällig',
  storniert: 'Storniert',
}

export function DocumentEditorPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const isNew = !id

  const { data: settings } = useSettings()
  const { data: contacts } = useContacts()
  const { data: accounts } = useAccounts()
  const { data: products } = useProducts({ activeOnly: true })
  const productByTitle = useMemo(
    () => new Map((products ?? []).map((p) => [p.title, p])),
    [products],
  )
  const { data: existing, isLoading } = useDocument(id)
  const createDoc = useCreateDocument()
  const updateDoc = useUpdateDocument()
  const deleteDoc = useDeleteDocument()
  const createTx = useCreateTransaction()

  const [state, setState] = useState<EditorState | null>(null)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [qrPng, setQrPng] = useState<string | null>(null)
  const [showEmail, setShowEmail] = useState(false)
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', body: '' })
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [showPay, setShowPay] = useState(false)
  const [payForm, setPayForm] = useState({
    date: todayIso(),
    amount: '',
    method: 'Bank',
    book: true,
    revenueAccountId: '',
    paymentAccountId: '',
  })

  // Initialise editor state once (new) or from the loaded document (edit).
  useEffect(() => {
    if (state) return
    if (isNew && settings) {
      const type = (params.get('typ') as DocumentType) || 'rechnung'
      const date = todayIso()
      setState({
        type,
        contactId: '',
        recipientSnapshot: { name: '', address: [], language: 'de' },
        date,
        dueDate: addDays(date, settings.invoice.defaultPaymentTermDays),
        lineItems: [newLineItem()],
        globalDiscountPct: 0,
        discounts: [],
        shipping: 0,
        introText: settings.invoice.defaultIntroText,
        outroText: settings.invoice.defaultOutroText,
        note: '',
        status: 'entwurf',
      })
    } else if (existing) {
      setState({
        type: existing.type,
        contactId: existing.contactId,
        recipientSnapshot: existing.recipientSnapshot,
        date: existing.date,
        dueDate: existing.dueDate ?? '',
        lineItems: existing.lineItems.length ? existing.lineItems : [newLineItem()],
        globalDiscountPct: existing.globalDiscountPct,
        discounts: existing.discounts ?? [],
        shipping: existing.shipping ?? 0,
        introText: existing.introText ?? '',
        outroText: existing.outroText ?? '',
        note: existing.note ?? '',
        status: existing.status,
      })
    }
  }, [isNew, settings, existing, params, state])

  const totals = useMemo(
    () =>
      state
        ? computeTotals({
            lineItems: state.lineItems,
            type: state.type,
            globalDiscountPct: state.globalDiscountPct,
            discounts: state.discounts,
            shipping: state.shipping,
          })
        : computeTotals({ lineItems: [], type: 'rechnung' }),
    [state],
  )

  const previewDoc: BusinessDocument | null = useMemo(() => {
    if (!state) return null
    return {
      id: id ?? 'preview',
      type: state.type,
      number: existing?.number ?? 'Entwurf',
      contactId: state.contactId,
      recipientSnapshot: state.recipientSnapshot,
      date: state.date,
      dueDate: state.dueDate || undefined,
      fiscalYear: fiscalYearOf(state.date),
      currency: 'CHF',
      lineItems: state.lineItems,
      globalDiscountPct: state.globalDiscountPct,
      discounts: state.discounts,
      shipping: state.shipping,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      total: totals.total,
      roundingDelta: totals.roundingDelta,
      status: state.status,
      payments: existing?.payments ?? [],
      introText: state.introText || undefined,
      outroText: state.outroText || undefined,
      note: state.note || undefined,
      templateId: 'default',
      dunningLevel: existing?.dunningLevel ?? 0,
    }
  }, [state, totals, id, existing])

  if (isLoading || !state || !settings) {
    return <p className="text-sm text-slate-400">Laden …</p>
  }

  function patch(p: Partial<EditorState>) {
    setState((s) => (s ? { ...s, ...p } : s))
  }

  function selectContact(contactId: string) {
    const c = contacts?.find((x) => x.id === contactId)
    if (!c) {
      patch({ contactId: '', recipientSnapshot: { name: '', address: [], language: 'de' } })
      return
    }
    patch({
      contactId,
      recipientSnapshot: recipientFromContact(c),
      dueDate: addDays(state!.date, c.paymentTermDays || settings!.invoice.defaultPaymentTermDays),
    })
  }

  function updateItem(itemId: string, p: Partial<LineItem>) {
    patch({
      lineItems: state!.lineItems.map((it) => (it.id === itemId ? { ...it, ...p } : it)),
    })
  }

  function updateDiscount(discId: string, p: Partial<DocumentDiscount>) {
    patch({
      discounts: state!.discounts.map((d) => (d.id === discId ? { ...d, ...p } : d)),
    })
  }

  async function save(navigateAfter = true) {
    if (!state) return
    setSaving(true)
    try {
      const t = computeTotals({
        lineItems: state.lineItems,
        type: state.type,
        globalDiscountPct: state.globalDiscountPct,
        discounts: state.discounts,
        shipping: state.shipping,
      })
      const base = {
        type: state.type,
        contactId: state.contactId,
        recipientSnapshot: state.recipientSnapshot,
        date: state.date,
        dueDate: state.dueDate || undefined,
        fiscalYear: fiscalYearOf(state.date),
        currency: 'CHF' as const,
        lineItems: state.lineItems,
        globalDiscountPct: state.globalDiscountPct,
        discounts: state.discounts,
        shipping: state.shipping,
        subtotal: t.subtotal,
        discountTotal: t.discountTotal,
        total: t.total,
        roundingDelta: t.roundingDelta,
        status: state.status,
        introText: state.introText || undefined,
        outroText: state.outroText || undefined,
        note: state.note || undefined,
        templateId: 'default',
      }
      if (isNew) {
        const number = await nextDocumentNumber(
          state.type,
          fiscalYearOf(state.date),
          settings!.invoice.numberPrefix[state.type],
        )
        const newId = await createDoc.mutateAsync({
          ...base,
          number,
          payments: [],
          dunningLevel: 0,
        } as Omit<BusinessDocument, 'id' | 'createdAt' | 'updatedAt'>)
        if (navigateAfter) navigate(`/dokumente/${newId}`, { replace: true })
      } else {
        await updateDoc.mutateAsync({ id: id!, ...base })
      }
    } finally {
      setSaving(false)
    }
  }

  function openEmail() {
    setEmailForm({
      to: state!.recipientSnapshot.email ?? '',
      subject: `${DOCUMENT_TYPE_LABEL[state!.type]} ${existing?.number ?? ''} von ${settings!.name}`,
      body: `Guten Tag\n\nanbei ${DOCUMENT_TYPE_LABEL[state!.type]} ${existing?.number ?? ''}.\n\nFreundliche Grüsse\n${settings!.name}`,
    })
    setEmailError(null)
    setShowEmail(true)
  }

  async function sendEmail() {
    if (!existing) return
    setEmailBusy(true)
    setEmailError(null)
    try {
      await emailDocument({
        document: { ...previewDoc!, id: existing.id, number: existing.number },
        settings: settings!,
        ...emailForm,
      })
      setShowEmail(false)
      patch({ status: 'versendet' })
    } catch (err) {
      setEmailError(
        err instanceof Error ? err.message : 'Versand fehlgeschlagen. PDF stattdessen herunterladen.',
      )
    } finally {
      setEmailBusy(false)
    }
  }

  const paid = existing ? amountPaid(existing) : 0
  const open = existing ? openAmount(existing) : totals.total
  const revenueAccounts = (accounts ?? []).filter((a) => a.type === 'ertrag' && a.active)
  const moneyAccounts = (accounts ?? []).filter((a) => a.type === 'aktiven' && a.active)

  function openPay() {
    setPayForm({
      date: todayIso(),
      amount: String(open > 0 ? open : totals.total),
      method: 'Bank',
      book: true,
      revenueAccountId:
        revenueAccounts.find((a) => a.number === '3200')?.id ?? revenueAccounts[0]?.id ?? '',
      paymentAccountId:
        moneyAccounts.find((a) => a.number === '1020')?.id ?? moneyAccounts[0]?.id ?? '',
    })
    setShowPay(true)
  }

  async function addPayment() {
    if (!existing) return
    const amount = round2(Number(payForm.amount))
    if (!amount || amount <= 0) return
    let transactionId: string | undefined
    if (payForm.book && payForm.revenueAccountId && payForm.paymentAccountId) {
      transactionId = await createTx.mutateAsync({
        date: payForm.date,
        fiscalYear: fiscalYearOf(payForm.date),
        description: `${DOCUMENT_TYPE_LABEL[existing.type]} ${existing.number} – ${existing.recipientSnapshot.name}`,
        amount,
        kind: existing.type === 'gutschrift' ? 'ausgabe' : 'einnahme',
        categoryAccountId: payForm.revenueAccountId,
        paymentAccountId: payForm.paymentAccountId,
        attachments: [],
        tags: [],
        source: 'manual',
        linkedDocumentId: existing.id,
        reconciled: true,
        locked: false,
      })
    }
    const payment: Payment = {
      id: crypto.randomUUID(),
      date: payForm.date,
      amount,
      method: payForm.method,
      transactionId,
    }
    const payments = [...existing.payments, payment]
    const newPaid = round2(payments.reduce((s, p) => s + p.amount, 0))
    const status: DocumentStatus = newPaid >= existing.total ? 'bezahlt' : 'teilbezahlt'
    await updateDoc.mutateAsync({ id: existing.id, payments, status })
    patch({ status })
    setShowPay(false)
  }

  async function convertToInvoice() {
    if (!existing) return
    const number = await nextDocumentNumber(
      'rechnung',
      fiscalYearOf(todayIso()),
      settings!.invoice.numberPrefix.rechnung,
    )
    const t = computeTotals({
      lineItems: existing.lineItems,
      type: 'rechnung',
      globalDiscountPct: existing.globalDiscountPct,
      discounts: existing.discounts,
      shipping: existing.shipping,
    })
    const newId = await createDoc.mutateAsync({
      ...existing,
      type: 'rechnung',
      number,
      date: todayIso(),
      dueDate: addDays(todayIso(), settings!.invoice.defaultPaymentTermDays),
      fiscalYear: fiscalYearOf(todayIso()),
      subtotal: t.subtotal,
      discountTotal: t.discountTotal,
      total: t.total,
      roundingDelta: t.roundingDelta,
      status: 'entwurf',
      payments: [],
      dunningLevel: 0,
      linkedFromId: existing.id,
      sentAt: undefined,
      sentTo: undefined,
      pdfStoragePath: undefined,
    } as Omit<BusinessDocument, 'id' | 'createdAt' | 'updatedAt'>)
    navigate(`/dokumente/${newId}`)
  }

  const title = isNew
    ? `Neue ${DOCUMENT_TYPE_LABEL[state.type]}`
    : `${DOCUMENT_TYPE_LABEL[state.type]} ${existing?.number ?? ''}`

  return (
    <>
      <PageHeader
        title={title}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate('/dokumente')}>
              <ArrowLeft className="size-4" /> Zurück
            </Button>
            {!isNew && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => previewDoc && downloadDocumentPdf(
                    { ...previewDoc, id: existing!.id, number: existing!.number },
                    settings,
                  )}
                >
                  <Download className="size-4" /> PDF
                </Button>
                <Button variant="secondary" onClick={openEmail}>
                  <Mail className="size-4" /> Senden
                </Button>
              </>
            )}
            <Button onClick={() => save()} disabled={saving}>
              {saving ? 'Speichern …' : 'Speichern'}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card title="Empfänger & Eckdaten">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Typ">
                <Select
                  value={state.type}
                  onChange={(e) => patch({ type: e.target.value as DocumentType })}
                  disabled={!isNew}
                >
                  {Object.entries(DOCUMENT_TYPE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Kunde">
                <Select value={state.contactId} onChange={(e) => selectContact(e.target.value)}>
                  <option value="">– wählen –</option>
                  {(contacts ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {contactName(c)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Datum">
                <Input
                  type="date"
                  value={state.date}
                  onChange={(e) => patch({ date: e.target.value })}
                />
              </Field>
              <Field label={state.type === 'rechnung' ? 'Zahlbar bis' : 'Gültig bis'}>
                <Input
                  type="date"
                  value={state.dueDate}
                  onChange={(e) => patch({ dueDate: e.target.value })}
                />
              </Field>
              {!isNew && (
                <Field label="Status">
                  <Select
                    value={state.status}
                    onChange={(e) => patch({ status: e.target.value as DocumentStatus })}
                  >
                    {Object.entries(STATUS_LABEL).map(([s, label]) => (
                      <option key={s} value={s}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
            {state.recipientSnapshot.name && (
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                {state.recipientSnapshot.name}
                {state.recipientSnapshot.address.map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
              </p>
            )}
          </Card>

          <Card title="Positionen">
            {(products?.length ?? 0) > 0 && (
              <datalist id="doc-products">
                {(products ?? []).map((p) => (
                  <option key={p.id} value={p.title}>
                    {formatCHF(p.price)}
                    {p.sku ? ` · ${p.sku}` : ''}
                  </option>
                ))}
              </datalist>
            )}
            <div className="space-y-2">
              {state.lineItems.map((it, idx) => (
                <div
                  key={it.id}
                  className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 p-2 sm:grid-cols-[1fr_70px_60px_80px_60px_28px] sm:border-0 sm:p-0"
                >
                  <input
                    list="doc-products"
                    className="col-span-2 rounded-lg border border-slate-300 px-2 py-1.5 text-sm sm:col-span-1"
                    placeholder={`Position ${idx + 1} – tippen oder Artikel wählen`}
                    value={it.description}
                    onChange={(e) => {
                      const value = e.target.value
                      const prod = productByTitle.get(value)
                      updateItem(
                        it.id,
                        prod
                          ? { description: value, unitPrice: prod.price, unit: prod.unit }
                          : { description: value },
                      )
                    }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="no-spin rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    placeholder="Menge"
                    value={it.quantity}
                    onChange={(e) => updateItem(it.id, { quantity: Number(e.target.value) })}
                  />
                  <input
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    placeholder="Einheit"
                    value={it.unit}
                    onChange={(e) => updateItem(it.id, { unit: e.target.value })}
                  />
                  <input
                    type="number"
                    step="0.05"
                    className="no-spin rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    placeholder="Preis"
                    value={it.unitPrice}
                    onChange={(e) => updateItem(it.id, { unitPrice: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    step="1"
                    className="no-spin rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    placeholder="Rab %"
                    value={it.discountPct}
                    onChange={(e) => updateItem(it.id, { discountPct: Number(e.target.value) })}
                  />
                  <button
                    type="button"
                    className="flex items-center justify-center text-slate-400 hover:text-red-600"
                    onClick={() =>
                      patch({ lineItems: state.lineItems.filter((x) => x.id !== it.id) })
                    }
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => patch({ lineItems: [...state.lineItems, newLineItem()] })}
            >
              <Plus className="size-4" /> Position
            </Button>
          </Card>

          <Card title="Rabatte & Versand">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Versandkosten CHF">
                <Input
                  type="number"
                  step="0.05"
                  className="no-spin"
                  value={state.shipping}
                  onChange={(e) => patch({ shipping: Number(e.target.value) || 0 })}
                />
              </Field>
            </div>

            <div className="mt-3 space-y-3">
              {state.discounts.map((d) => (
                <div key={d.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_130px_90px_28px]">
                    <input
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                      placeholder="Bezeichnung (z.B. Sommeraktion)"
                      value={d.label}
                      onChange={(e) => updateDiscount(d.id, { label: e.target.value })}
                    />
                    <select
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      value={d.kind}
                      onChange={(e) =>
                        updateDiscount(d.id, {
                          kind: e.target.value as DocumentDiscount['kind'],
                        })
                      }
                    >
                      <option value="percent">Prozent %</option>
                      <option value="amount">Fester Betrag CHF</option>
                      <option value="freeShipping">Gratis Versand</option>
                    </select>
                    {d.kind !== 'freeShipping' ? (
                      <input
                        type="number"
                        step={d.kind === 'percent' ? '1' : '0.05'}
                        className="no-spin rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        value={d.value}
                        onChange={(e) => updateDiscount(d.id, { value: Number(e.target.value) || 0 })}
                      />
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      className="flex items-center justify-center text-slate-400 hover:text-red-600"
                      onClick={() =>
                        patch({ discounts: state.discounts.filter((x) => x.id !== d.id) })
                      }
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {d.kind === 'percent' && (
                    <div className="mt-2 space-y-1 text-xs">
                      <label className="flex items-center gap-2 text-slate-600">
                        <input
                          type="radio"
                          checked={d.scope === 'total'}
                          onChange={() => updateDiscount(d.id, { scope: 'total', lineItemIds: [] })}
                        />
                        Auf die ganze Rechnung
                      </label>
                      <label className="flex items-center gap-2 text-slate-600">
                        <input
                          type="radio"
                          checked={d.scope === 'lines'}
                          onChange={() => updateDiscount(d.id, { scope: 'lines' })}
                        />
                        Nur auf bestimmte Positionen
                      </label>
                      {d.scope === 'lines' && (
                        <div className="ml-5 flex flex-wrap gap-2 pt-1">
                          {state.lineItems.map((it, i) => (
                            <label
                              key={it.id}
                              className="flex items-center gap-1 rounded border border-slate-200 px-2 py-0.5"
                            >
                              <input
                                type="checkbox"
                                checked={d.lineItemIds?.includes(it.id) ?? false}
                                onChange={(e) => {
                                  const set = new Set(d.lineItemIds ?? [])
                                  if (e.target.checked) set.add(it.id)
                                  else set.delete(it.id)
                                  updateDiscount(d.id, { lineItemIds: [...set] })
                                }}
                              />
                              Pos {i + 1}
                              {it.description ? ` – ${it.description.slice(0, 20)}` : ''}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => patch({ discounts: [...state.discounts, newDiscount()] })}
            >
              <Plus className="size-4" /> Rabatt
            </Button>
          </Card>

          <Card title="Texte">
            <div className="space-y-3">
              <Field label="Einleitungstext">
                <Textarea
                  rows={2}
                  value={state.introText}
                  onChange={(e) => patch({ introText: e.target.value })}
                />
              </Field>
              <Field label="Schlusstext">
                <Textarea
                  rows={2}
                  value={state.outroText}
                  onChange={(e) => patch({ outroText: e.target.value })}
                />
              </Field>
              <Field label="Interne Notiz (nicht auf dem PDF)">
                <Textarea
                  rows={2}
                  value={state.note}
                  onChange={(e) => patch({ note: e.target.value })}
                />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card title="Summe">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Zwischensumme</span>
                <span>{formatCHF(totals.subtotal)}</span>
              </div>
              {totals.discountLines
                .filter((l) => !l.isShipping)
                .map((l, i) => (
                  <div key={i} className="flex justify-between text-slate-500">
                    <span>{l.label}</span>
                    <span>−{formatCHF(l.amount)}</span>
                  </div>
                ))}
              {totals.shipping > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Versand</span>
                  <span>{formatCHF(totals.shipping)}</span>
                </div>
              )}
              {totals.freeShipping && totals.shipping > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Gratis Versand</span>
                  <span>−{formatCHF(totals.shipping)}</span>
                </div>
              )}
              {Math.abs(totals.roundingDelta) >= 0.01 && (
                <div className="flex justify-between text-slate-500">
                  <span>Rundung</span>
                  <span>{formatCHF(totals.roundingDelta)}</span>
                </div>
              )}
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatCHF(totals.total)}</span>
              </div>
            </div>
          </Card>

          <Button
            variant="secondary"
            className="w-full"
            onClick={async () => {
              setShowPreview(true)
              if (previewDoc && previewDoc.type === 'rechnung') {
                setQrPng(await buildQrBillPng(previewDoc, settings))
              } else {
                setQrPng(null)
              }
            }}
            disabled={!state.contactId}
          >
            PDF-Vorschau
          </Button>
          {isNew && (
            <p className="text-xs text-slate-400">
              Nummer und Versand sind nach dem ersten Speichern verfügbar.
            </p>
          )}

          {!isNew && existing && (state.type === 'offerte' || state.type === 'auftragsbestaetigung') && (
            <Button variant="secondary" className="w-full" onClick={convertToInvoice}>
              In Rechnung umwandeln
            </Button>
          )}

          {!isNew && existing && (state.type === 'rechnung' || state.type === 'gutschrift') && (
            <Card title="Zahlungen">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Bezahlt</span>
                  <span>{formatCHF(paid)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Offen</span>
                  <span>{formatCHF(open)}</span>
                </div>
              </div>
              {existing.payments.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
                  {existing.payments.map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span>
                        {p.date} · {p.method}
                        {p.transactionId ? ' · verbucht' : ''}
                      </span>
                      <span>{formatCHF(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {open > 0 && (
                <Button size="sm" className="mt-3 w-full" onClick={openPay}>
                  Zahlung erfassen
                </Button>
              )}
            </Card>
          )}

          {!isNew && (
            <Button
              variant="ghost"
              className="w-full text-red-600"
              onClick={() => {
                if (existing && confirm(`${title} löschen?`)) {
                  deleteDoc.mutate(existing.id)
                  navigate('/dokumente')
                }
              }}
            >
              Dokument löschen
            </Button>
          )}
        </div>
      </div>

      <Modal open={showPreview} onClose={() => setShowPreview(false)} title="PDF-Vorschau" wide>
        {previewDoc && (
          <div className="h-[82vh]">
            <PDFViewer width="100%" height="100%" showToolbar>
              <DocumentPdf document={previewDoc} settings={settings} qrBillPng={qrPng} />
            </PDFViewer>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">
          Diese Vorschau ist identisch mit dem heruntergeladenen und dem per E-Mail versendeten PDF.
        </p>
      </Modal>

      <Modal open={showPay} onClose={() => setShowPay(false)} title="Zahlung erfassen">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Datum">
              <Input
                type="date"
                value={payForm.date}
                onChange={(e) => setPayForm({ ...payForm, date: e.target.value })}
              />
            </Field>
            <Field label="Betrag CHF">
              <Input
                type="number"
                step="0.05"
                className="no-spin"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Zahlungsart">
            <Input
              value={payForm.method}
              onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={payForm.book}
              onChange={(e) => setPayForm({ ...payForm, book: e.target.checked })}
            />
            Als Buchung im Journal erfassen
          </label>
          {payForm.book && (
            <div className="grid grid-cols-1 gap-3">
              <Field label={existing?.type === 'gutschrift' ? 'Aufwandskonto' : 'Ertragskonto'}>
                <Select
                  value={payForm.revenueAccountId}
                  onChange={(e) => setPayForm({ ...payForm, revenueAccountId: e.target.value })}
                >
                  {revenueAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.number} {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Geldkonto">
                <Select
                  value={payForm.paymentAccountId}
                  onChange={(e) => setPayForm({ ...payForm, paymentAccountId: e.target.value })}
                >
                  {moneyAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.number} {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={addPayment}>Speichern</Button>
            <Button variant="ghost" onClick={() => setShowPay(false)}>
              Abbrechen
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={showEmail} onClose={() => setShowEmail(false)} title="Per E-Mail senden">
        <div className="space-y-3">
          <Field label="An">
            <Input
              type="email"
              value={emailForm.to}
              onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
            />
          </Field>
          <Field label="Betreff">
            <Input
              value={emailForm.subject}
              onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
            />
          </Field>
          <Field label="Nachricht">
            <Textarea
              rows={5}
              value={emailForm.body}
              onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
            />
          </Field>
          {emailError && (
            <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{emailError}</p>
          )}
          <div className="flex gap-2">
            <Button onClick={sendEmail} disabled={emailBusy || !emailForm.to}>
              {emailBusy ? 'Senden …' : 'Senden'}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                previewDoc &&
                downloadDocumentPdf(
                  { ...previewDoc, id: existing!.id, number: existing!.number },
                  settings,
                )
              }
            >
              <Download className="size-4" /> Stattdessen PDF herunterladen
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
