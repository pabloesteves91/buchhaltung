import { useMemo, useState } from 'react'
import { Paperclip, Plus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, EmptyState, Select, TableWrap } from '@/components/ui'
import { TransactionModal } from '@/components/TransactionModal'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { formatCHF, formatDate } from '@/lib/format'
import type { Transaction } from '@/lib/types'

export function JournalPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const { data: accounts } = useAccounts()
  const { data: transactions, isLoading } = useTransactions(year)
  const [modal, setModal] = useState<{ tx: Transaction | null } | null>(null)

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

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <>
      <PageHeader
        title="Buchungen"
        subtitle="Einnahmen und Ausgaben erfassen – Beleg anhängen, Zeile anklicken zum Bearbeiten."
        actions={
          <>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Button onClick={() => setModal({ tx: null })}>
              <Plus className="size-4" /> Buchung
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
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

      {isLoading ? (
        <p className="text-sm text-slate-400">Laden …</p>
      ) : (transactions?.length ?? 0) === 0 ? (
        <EmptyState
          title={`Keine Buchungen ${year}`}
          description="Erfasse deine erste Einnahme oder Ausgabe."
          action={<Button onClick={() => setModal({ tx: null })}>Buchung erfassen</Button>}
        />
      ) : (
        <Card>
          <TableWrap>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="py-2">Datum</th>
                  <th className="py-2">Beschreibung</th>
                  <th className="py-2">Kategorie</th>
                  <th className="py-2">Konto</th>
                  <th className="py-2 text-right">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {transactions!.map((t) => (
                  <tr
                    key={t.id}
                    className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    onClick={() => setModal({ tx: t })}
                  >
                    <td className="py-2 whitespace-nowrap text-slate-500">{formatDate(t.date)}</td>
                    <td className="py-2">
                      <span className="inline-flex items-center gap-1.5">
                        {(t.attachments?.length ?? 0) > 0 && (
                          <Paperclip className="size-3 text-slate-400" />
                        )}
                        {t.description || <span className="text-slate-400">–</span>}
                      </span>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}

      {modal && (
        <TransactionModal
          key={modal.tx?.id ?? 'new'}
          open
          transaction={modal.tx}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
