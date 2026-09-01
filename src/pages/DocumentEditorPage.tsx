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
import { computeTotals, newLineItem } from '@/lib/documentTotals'
import { DocumentPdf } from '@/pdf/DocumentPdf'
import { downloadDocumentPdf, emailDocument } from '@/pdf/pdfActions'
import { fiscalYearOf, formatCHF, todayIso } from '@/lib/format'
import type {
  BusinessDocument,
  Contact,
  DocumentStatus,
  DocumentType,
  LineItem,
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
  const { data: existing, isLoading } = useDocument(id)
  const createDoc = useCreateDocument()
  const updateDoc = useUpdateDocument()
  const deleteDoc = useDeleteDocument()

  const [state, setState] = useState<EditorState | null>(null)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', body: '' })
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

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
        ? computeTotals(state.lineItems, state.globalDiscountPct, state.type)
        : { subtotal: 0, discountTotal: 0, total: 0, roundingDelta: 0 },
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
      ...totals,
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

  async function save(navigateAfter = true) {
    if (!state) return
    setSaving(true)
    try {
      const t = computeTotals(state.lineItems, state.globalDiscountPct, state.type)
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
        ...t,
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
            <div className="space-y-2">
              {state.lineItems.map((it, idx) => (
                <div
                  key={it.id}
                  className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 p-2 sm:grid-cols-[1fr_70px_60px_80px_60px_28px] sm:border-0 sm:p-0"
                >
                  <input
                    className="col-span-2 rounded-lg border border-slate-300 px-2 py-1.5 text-sm sm:col-span-1"
                    placeholder={`Position ${idx + 1}`}
                    value={it.description}
                    onChange={(e) => updateItem(it.id, { description: e.target.value })}
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
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Rabatt gesamt %</span>
                <input
                  type="number"
                  className="no-spin w-16 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                  value={state.globalDiscountPct}
                  onChange={(e) => patch({ globalDiscountPct: Number(e.target.value) })}
                />
              </div>
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
            onClick={() => setShowPreview(true)}
            disabled={!state.contactId}
          >
            PDF-Vorschau
          </Button>
          {isNew && (
            <p className="text-xs text-slate-400">
              Nummer und Versand sind nach dem ersten Speichern verfügbar.
            </p>
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
          <div className="h-[70vh]">
            <PDFViewer width="100%" height="100%" showToolbar>
              <DocumentPdf document={previewDoc} settings={settings} />
            </PDFViewer>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">
          Diese Vorschau ist identisch mit dem heruntergeladenen und dem per E-Mail versendeten PDF.
        </p>
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
