import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Paperclip, Plus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, Select, Skeleton, TableWrap } from '@/components/ui'
import { DataTable, Td, Th, Tr } from '@/components/DataTable'
import { StatCard } from '@/components/StatCard'
import { TransactionModal } from '@/components/TransactionModal'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { cn } from '@/lib/cn'
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
    return a ? `${a.number} ${a.name}` : '–'
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
        <StatCard label={`Einnahmen ${year}`} value={formatCHF(total.inc)} tone="positive" />
        <StatCard label={`Ausgaben ${year}`} value={formatCHF(total.exp)} tone="negative" />
        <StatCard label={`Ergebnis ${year}`} value={formatCHF(total.net)} />
      </div>

      {isLoading ? (
        <Card>
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </Card>
      ) : (transactions?.length ?? 0) === 0 ? (
        <EmptyState
          title={`Keine Buchungen ${year}`}
          description="Erfasse deine erste Einnahme oder Ausgabe."
          action={<Button onClick={() => setModal({ tx: null })}>Buchung erfassen</Button>}
        />
      ) : (
        <Card>
          <TableWrap>
            <DataTable
              minWidth={640}
              head={
                <>
                  <Th>Datum</Th>
                  <Th>Beschreibung</Th>
                  <Th>Kategorie</Th>
                  <Th>Konto</Th>
                  <Th align="right">Betrag</Th>
                </>
              }
            >
              {transactions!.map((t) => (
                <Tr key={t.id} interactive onClick={() => setModal({ tx: t })}>
                  <Td className="whitespace-nowrap text-muted-foreground">{formatDate(t.date)}</Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5">
                      {(t.attachments?.length ?? 0) > 0 && (
                        <Paperclip className="size-3 text-muted-foreground" />
                      )}
                      {t.description || <span className="text-muted-foreground">–</span>}
                    </span>
                    {t.tags.length > 0 && (
                      <span className="ml-2 inline-flex gap-1 align-middle">
                        {t.tags.map((tag) => (
                          <Badge key={tag} tone={tag === 'Printful' ? 'amber' : 'slate'}>
                            {tag}
                          </Badge>
                        ))}
                      </span>
                    )}
                    {t.shopifyOrderId && (
                      <Link
                        to={`/shopify/bestellung/${t.shopifyOrderId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="ml-2 text-xs text-brand-600 hover:underline"
                      >
                        Bestellung ansehen
                      </Link>
                    )}
                  </Td>
                  <Td className="text-muted-foreground">{accName(t.categoryAccountId)}</Td>
                  <Td className="text-muted-foreground">{accName(t.paymentAccountId)}</Td>
                  <Td
                    align="right"
                    className={cn(
                      'font-medium',
                      t.kind === 'einnahme'
                        ? 'text-success'
                        : t.kind === 'ausgabe'
                          ? 'text-destructive'
                          : 'text-foreground',
                    )}
                  >
                    {t.kind === 'ausgabe' ? '−' : t.kind === 'einnahme' ? '+' : ''}
                    {formatCHF(t.amount)}
                  </Td>
                </Tr>
              ))}
            </DataTable>
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
