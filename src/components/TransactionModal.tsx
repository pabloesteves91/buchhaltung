import { useMemo, useState } from 'react'
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { AttachmentList } from '@/components/AttachmentList'
import { useAccounts } from '@/hooks/useAccounts'
import { useFiscalYears, isDateLocked } from '@/hooks/useFiscalYears'
import {
  useCreateTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
} from '@/hooks/useTransactions'
import { fiscalYearOf, round2, todayIso } from '@/lib/format'
import type { Account, Attachment, Transaction, TransactionKind } from '@/lib/types'

const KIND_LABEL: Record<TransactionKind, string> = {
  einnahme: 'Einnahme',
  ausgabe: 'Ausgabe',
  umbuchung: 'Umbuchung',
}

interface FormState {
  date: string
  kind: TransactionKind
  amount: string
  description: string
  categoryAccountId: string
  paymentAccountId: string
  note: string
  tags: string
  attachments: Attachment[]
}

function fromTx(t: Transaction): FormState {
  return {
    date: t.date,
    kind: t.kind,
    amount: String(t.amount),
    description: t.description,
    categoryAccountId: t.categoryAccountId,
    paymentAccountId: t.paymentAccountId,
    note: t.note ?? '',
    tags: t.tags.join(', '),
    attachments: t.attachments ?? [],
  }
}

const empty = (kind: TransactionKind = 'ausgabe'): FormState => ({
  date: todayIso(),
  kind,
  amount: '',
  description: '',
  categoryAccountId: '',
  paymentAccountId: '',
  note: '',
  tags: '',
  attachments: [],
})

export function TransactionModal({
  open,
  onClose,
  transaction,
  defaultKind,
}: {
  open: boolean
  onClose: () => void
  transaction: Transaction | null
  defaultKind?: TransactionKind
}) {
  const { data: accounts } = useAccounts()
  const { data: fiscalYears } = useFiscalYears()
  const createTx = useCreateTransaction()
  const updateTx = useUpdateTransaction()
  const deleteTx = useDeleteTransaction()

  const [form, setForm] = useState<FormState>(
    transaction ? fromTx(transaction) : empty(defaultKind),
  )
  const [txId, setTxId] = useState<string | null>(transaction?.id ?? null)
  const [busy, setBusy] = useState(false)

  const dateLocked = isDateLocked(form.date, fiscalYears)

  const paymentAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.type === 'aktiven' || a.number.startsWith('2')),
    [accounts],
  )
  const categoryAccounts = useMemo(() => {
    const byKind: Record<TransactionKind, (a: Account) => boolean> = {
      einnahme: (a) => a.type === 'ertrag',
      ausgabe: (a) => a.type === 'aufwand',
      umbuchung: (a) => a.type === 'aktiven' || a.type === 'passiven',
    }
    return (accounts ?? []).filter((a) => a.active && byKind[form.kind](a))
  }, [accounts, form.kind])

  const amount = round2(Number(form.amount))
  const valid = amount > 0 && form.categoryAccountId && form.paymentAccountId && !dateLocked

  function payload() {
    return {
      date: form.date,
      fiscalYear: fiscalYearOf(form.date),
      description: form.description.trim(),
      amount,
      kind: form.kind,
      categoryAccountId: form.categoryAccountId,
      paymentAccountId: form.paymentAccountId,
      attachments: form.attachments,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      note: form.note.trim() || undefined,
    }
  }

  async function ensureId(): Promise<string> {
    if (txId) return txId
    const id = await createTx.mutateAsync({
      ...payload(),
      source: 'manual',
      reconciled: false,
      locked: false,
    })
    setTxId(id)
    return id
  }

  async function save() {
    if (!valid) return
    setBusy(true)
    try {
      if (txId) await updateTx.mutateAsync({ id: txId, ...payload() })
      else await ensureId()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={transaction ? 'Buchung bearbeiten' : 'Neue Buchung'}
      wide
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Art">
            <Select
              value={form.kind}
              onChange={(e) =>
                setForm({ ...form, kind: e.target.value as TransactionKind, categoryAccountId: '' })
              }
            >
              {Object.entries(KIND_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Datum">
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Betrag CHF">
            <Input
              type="number"
              step="0.05"
              min="0"
              className="no-spin"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-3">
            <Field label="Beschreibung">
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="z.B. Warenrechnung Lieferant Tokyo"
              />
            </Field>
          </div>
          <Field label={form.kind === 'umbuchung' ? 'Zielkonto' : 'Kategorie'}>
            <Select
              value={form.categoryAccountId}
              onChange={(e) => setForm({ ...form, categoryAccountId: e.target.value })}
            >
              <option value="">– wählen –</option>
              {categoryAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.number} {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={form.kind === 'einnahme' ? 'Eingang auf' : 'Bezahlt ab'}>
            <Select
              value={form.paymentAccountId}
              onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}
            >
              <option value="">– wählen –</option>
              {paymentAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.number} {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tags (Komma-getrennt)">
            <Input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="Import Japan, Messe"
            />
          </Field>
        </div>

        <Field label="Notiz">
          <Textarea
            rows={2}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </Field>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-600">Belege</p>
          <AttachmentList
            folder={`receipts/${txId ?? 'pending'}`}
            attachments={form.attachments}
            onChange={async (next) => {
              setForm((f) => ({ ...f, attachments: next }))
              // Persist immediately if the transaction already exists.
              const id = txId ?? (form.description || amount ? await ensureId() : null)
              if (id) await updateTx.mutateAsync({ id, attachments: next })
            }}
          />
          {!txId && (
            <p className="mt-1 text-xs text-slate-400">
              Beim ersten Beleg wird die Buchung automatisch gespeichert.
            </p>
          )}
        </div>

        {dateLocked && (
          <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-700">
            Datum liegt in einem abgeschlossenen Geschäftsjahr – gesperrt.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button onClick={save} disabled={!valid || busy}>
              Speichern
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
          </div>
          {transaction && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (isDateLocked(transaction.date, fiscalYears)) {
                  alert('Diese Buchung liegt in einem abgeschlossenen Jahr.')
                  return
                }
                if (confirm('Buchung löschen?')) {
                  deleteTx.mutate(transaction.id)
                  onClose()
                }
              }}
            >
              Löschen
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
