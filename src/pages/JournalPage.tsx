import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, EmptyState, Field, Input, Select, Textarea } from '@/components/ui'
import { useAccounts } from '@/hooks/useAccounts'
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
} from '@/hooks/useTransactions'
import { formatCHF, formatDate, fiscalYearOf, round2, todayIso } from '@/lib/format'
import type { Account, TransactionKind } from '@/lib/types'

const KIND_LABEL: Record<TransactionKind, string> = {
  einnahme: 'Einnahme',
  ausgabe: 'Ausgabe',
  umbuchung: 'Umbuchung',
}

const emptyForm = () => ({
  date: todayIso(),
  kind: 'ausgabe' as TransactionKind,
  amount: '',
  description: '',
  categoryAccountId: '',
  paymentAccountId: '',
  note: '',
  tags: '',
})

export function JournalPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const { data: accounts } = useAccounts()
  const { data: transactions, isLoading } = useTransactions(year)
  const createTx = useCreateTransaction()
  const deleteTx = useDeleteTransaction()
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(emptyForm())

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

  const total = useMemo(() => {
    let inc = 0
    let exp = 0
    for (const t of transactions ?? []) {
      if (t.kind === 'einnahme') inc += t.amount
      else if (t.kind === 'ausgabe') exp += t.amount
    }
    return { inc, exp, net: inc - exp }
  }, [transactions])

  const accName = (id: string) => {
    const a = accounts?.find((x) => x.id === id)
    return a ? `${a.number} ${a.name}` : '—'
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const amount = round2(Number(form.amount))
    if (!amount || amount <= 0 || !form.categoryAccountId || !form.paymentAccountId) return
    await createTx.mutateAsync({
      date: form.date,
      fiscalYear: fiscalYearOf(form.date),
      description: form.description.trim(),
      amount,
      kind: form.kind,
      categoryAccountId: form.categoryAccountId,
      paymentAccountId: form.paymentAccountId,
      attachments: [],
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      note: form.note.trim() || undefined,
      source: 'manual',
      reconciled: false,
      locked: false,
    })
    setForm(emptyForm())
    setShowNew(false)
  }

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <>
      <PageHeader
        title="Buchungen"
        subtitle="Einnahmen und Ausgaben erfassen (einfache Buchhaltung)."
        actions={
          <>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Button onClick={() => setShowNew((v) => !v)}>
              <Plus className="size-4" /> Buchung
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card>
          <p className="text-xs text-slate-500">Einnahmen {year}</p>
          <p className="mt-1 text-xl font-semibold text-green-600">{formatCHF(total.inc)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Ausgaben {year}</p>
          <p className="mt-1 text-xl font-semibold text-red-600">{formatCHF(total.exp)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Ergebnis {year}</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatCHF(total.net)}</p>
        </Card>
      </div>

      {showNew && (
        <Card title="Neue Buchung" className="mb-6">
          <form onSubmit={submit} className="grid grid-cols-2 gap-3 md:grid-cols-3">
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
            <Field label="Beschreibung">
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="z.B. Warenrechnung Lieferant Tokyo"
              />
            </Field>
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
            <div className="col-span-2 md:col-span-1">
              <Field label="Notiz">
                <Textarea
                  rows={1}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </Field>
            </div>
            <div className="col-span-2 flex gap-2 md:col-span-3">
              <Button type="submit" disabled={createTx.isPending}>
                Buchung speichern
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowNew(false)}>
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400">Laden …</p>
      ) : (transactions?.length ?? 0) === 0 ? (
        <EmptyState
          title={`Keine Buchungen ${year}`}
          description="Erfasse deine erste Einnahme oder Ausgabe."
          action={<Button onClick={() => setShowNew(true)}>Buchung erfassen</Button>}
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="py-2">Datum</th>
                <th className="py-2">Beschreibung</th>
                <th className="py-2">Kategorie</th>
                <th className="py-2">Konto</th>
                <th className="py-2 text-right">Betrag</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {transactions!.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 whitespace-nowrap text-slate-500">{formatDate(t.date)}</td>
                  <td className="py-2">
                    {t.description || <span className="text-slate-400">–</span>}
                    {t.tags.length > 0 && (
                      <span className="ml-2 text-xs text-slate-400">{t.tags.join(', ')}</span>
                    )}
                  </td>
                  <td className="py-2 text-slate-500">{accName(t.categoryAccountId)}</td>
                  <td className="py-2 text-slate-500">{accName(t.paymentAccountId)}</td>
                  <td
                    className={`py-2 text-right font-medium ${
                      t.kind === 'einnahme'
                        ? 'text-green-600'
                        : t.kind === 'ausgabe'
                          ? 'text-red-600'
                          : 'text-slate-700'
                    }`}
                  >
                    {t.kind === 'ausgabe' ? '−' : t.kind === 'einnahme' ? '+' : ''}
                    {formatCHF(t.amount)}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      className="text-xs text-slate-400 hover:text-red-600"
                      onClick={() => {
                        if (confirm('Buchung löschen?')) deleteTx.mutate(t.id)
                      }}
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  )
}
