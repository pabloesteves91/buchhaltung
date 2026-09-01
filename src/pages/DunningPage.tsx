import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Mail, Send } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, TableWrap, Textarea } from '@/components/ui'
import { useDocuments, useUpdateDocument } from '@/hooks/useDocuments'
import { useSettings } from '@/hooks/useSettings'
import {
  DUNNING_LABEL,
  cumulativeFee,
  daysOverdue,
  dunningDocument,
  dunningDue,
  isOverdue,
} from '@/lib/dunning'
import { amountPaid } from '@/lib/documentTotals'
import { downloadDocumentPdf, emailDocument } from '@/pdf/pdfActions'
import { formatCHF, formatDate, todayIso } from '@/lib/format'
import type { BusinessDocument } from '@/lib/types'

export function DunningPage() {
  const { data: docs } = useDocuments('rechnung')
  const { data: settings } = useSettings()
  const updateDoc = useUpdateDocument()
  const [emailFor, setEmailFor] = useState<{ inv: BusinessDocument; level: 1 | 2 | 3 } | null>(null)
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', body: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const overdue = useMemo(
    () =>
      (docs ?? [])
        .filter((d) => isOverdue(d))
        .sort((a, b) => daysOverdue(b) - daysOverdue(a)),
    [docs],
  )

  const totalOpen = overdue.reduce((s, d) => s + (d.total - amountPaid(d)), 0)

  function nextLevel(d: BusinessDocument): 1 | 2 | 3 {
    return Math.min(3, d.dunningLevel + 1) as 1 | 2 | 3
  }

  async function markDunned(inv: BusinessDocument, level: 1 | 2 | 3) {
    await updateDoc.mutateAsync({
      id: inv.id,
      dunningLevel: level,
      lastDunnedAt: todayIso(),
      status: 'ueberfaellig',
    })
  }

  async function download(inv: BusinessDocument, level: 1 | 2 | 3) {
    if (!settings) return
    setBusy(true)
    try {
      const doc = dunningDocument(inv, level, settings)
      await downloadDocumentPdf(doc, settings, {
        withQr: true,
        heading: `${DUNNING_LABEL[level - 1]} zu Rechnung ${inv.number}`,
        fileLabel: `Mahnung${level}`,
      })
      await markDunned(inv, level)
    } finally {
      setBusy(false)
    }
  }

  function openEmail(inv: BusinessDocument, level: 1 | 2 | 3) {
    setEmailFor({ inv, level })
    setEmailForm({
      to: inv.recipientSnapshot.email ?? '',
      subject: `${DUNNING_LABEL[level - 1]} – Rechnung ${inv.number}`,
      body: `Guten Tag\n\n${settings?.dunning?.texts[level - 1] ?? ''}\n\nOffener Betrag inkl. Mahngebühr: siehe Anhang.\n\nFreundliche Grüsse\n${settings?.name ?? ''}`,
    })
    setErr(null)
  }

  async function sendEmail() {
    if (!emailFor || !settings) return
    setBusy(true)
    setErr(null)
    try {
      const doc = dunningDocument(emailFor.inv, emailFor.level, settings)
      await emailDocument({
        document: doc,
        settings,
        ...emailForm,
        pdfOptions: {
          withQr: true,
          heading: `${DUNNING_LABEL[emailFor.level - 1]} zu Rechnung ${emailFor.inv.number}`,
          fileLabel: `Mahnung${emailFor.level}`,
        },
      })
      await markDunned(emailFor.inv, emailFor.level)
      setEmailFor(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Versand fehlgeschlagen – PDF stattdessen herunterladen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Mahnwesen" subtitle="Überfällige Rechnungen und Mahnungen." />

      {overdue.length === 0 ? (
        <EmptyState title="Keine überfälligen Rechnungen" description="Alles im grünen Bereich." />
      ) : (
        <>
          <Card className="mb-4">
            <p className="text-xs text-slate-500">Überfällig gesamt</p>
            <p className="mt-1 text-xl font-semibold text-red-600">{formatCHF(totalOpen)}</p>
            <p className="mt-1 text-xs text-slate-400">{overdue.length} Rechnung(en)</p>
          </Card>

          <Card>
            <TableWrap>
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="py-2">Rechnung</th>
                    <th className="py-2">Kunde</th>
                    <th className="py-2">Fällig</th>
                    <th className="py-2 text-right">Tage</th>
                    <th className="py-2 text-right">Offen</th>
                    <th className="py-2">Stufe</th>
                    <th className="py-2 text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((d) => {
                    const level = nextLevel(d)
                    const canDun = d.dunningLevel < 3
                    const due = dunningDue(d, settings!)
                    return (
                      <tr key={d.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 font-medium text-slate-700">
                          <Link to={`/dokumente/${d.id}`}>{d.number}</Link>
                        </td>
                        <td className="py-2 text-slate-600">{d.recipientSnapshot.name}</td>
                        <td className="py-2 whitespace-nowrap text-slate-500">
                          {formatDate(d.dueDate)}
                        </td>
                        <td className="py-2 text-right text-red-600">{daysOverdue(d)}</td>
                        <td className="py-2 text-right font-medium">
                          {formatCHF(d.total - amountPaid(d))}
                        </td>
                        <td className="py-2">
                          {d.dunningLevel > 0 ? (
                            <Badge tone={d.dunningLevel >= 3 ? 'red' : 'amber'}>
                              {DUNNING_LABEL[d.dunningLevel - 1]}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400">–</span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {canDun ? (
                            <div className="flex justify-end gap-1">
                              <button
                                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-brand-600 disabled:opacity-40"
                                title={`${DUNNING_LABEL[level - 1]} als PDF (Gebühr ${formatCHF(cumulativeFee(level, settings!))})`}
                                onClick={() => download(d, level)}
                                disabled={busy}
                              >
                                <Download className="size-4" />
                              </button>
                              <button
                                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-brand-600 disabled:opacity-40"
                                title={`${DUNNING_LABEL[level - 1]} per E-Mail`}
                                onClick={() => openEmail(d, level)}
                                disabled={busy}
                              >
                                <Mail className="size-4" />
                              </button>
                              {!due && d.dunningLevel > 0 && (
                                <span className="self-center text-[10px] text-slate-400">
                                  Frist läuft
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">max. Stufe</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableWrap>
          </Card>

          <p className="mt-3 text-xs text-slate-400">
            Die Mahngebühr erscheint auf dem PDF. Bezahlt der Kunde inkl. Gebühr, erfasse die
            zusätzliche Einnahme als Buchung (z. B. Konto 3600).
          </p>
        </>
      )}

      <Modal open={!!emailFor} onClose={() => setEmailFor(null)} title="Mahnung per E-Mail">
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
              rows={6}
              value={emailForm.body}
              onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
            />
          </Field>
          {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <Button onClick={sendEmail} disabled={busy || !emailForm.to}>
              <Send className="size-4" /> Senden
            </Button>
            <Button
              variant="secondary"
              onClick={() => emailFor && download(emailFor.inv, emailFor.level)}
            >
              <Download className="size-4" /> Stattdessen PDF
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
