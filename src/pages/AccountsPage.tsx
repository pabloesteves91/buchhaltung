import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, Field, Input, Select, TableWrap } from '@/components/ui'
import {
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
} from '@/hooks/useAccounts'
import {
  KMU_KONTENRAHMEN,
  resolvedAccountType,
} from '@/data/kmuKontenrahmen'
import type { Account, AccountType } from '@/lib/types'
import { Collections, createDoc } from '@/lib/db'
import { useQueryClient } from '@tanstack/react-query'

const TYPE_LABEL: Record<AccountType, string> = {
  aktiven: 'Aktiven',
  passiven: 'Passiven',
  aufwand: 'Aufwand',
  ertrag: 'Ertrag',
}

const TYPE_TONE: Record<AccountType, 'green' | 'amber' | 'red' | 'blue'> = {
  aktiven: 'blue',
  passiven: 'amber',
  aufwand: 'red',
  ertrag: 'green',
}

export function AccountsPage() {
  const qc = useQueryClient()
  const { data: accounts, isLoading } = useAccounts()
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()
  const deleteAccount = useDeleteAccount()
  const [seeding, setSeeding] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ number: '', name: '', group: '', type: 'aufwand' as AccountType })

  const grouped = useMemo(() => {
    const byGroup = new Map<string, Account[]>()
    for (const a of accounts ?? []) {
      const list = byGroup.get(a.group) ?? []
      list.push(a)
      byGroup.set(a.group, list)
    }
    return [...byGroup.entries()].sort((a, b) => (a[1][0].number < b[1][0].number ? -1 : 1))
  }, [accounts])

  async function seed() {
    setSeeding(true)
    try {
      for (const a of KMU_KONTENRAHMEN) {
        const type = resolvedAccountType(a.number)
        await createDoc(Collections.accounts, {
          number: a.number,
          name: a.name,
          type,
          group: a.group,
          isSystem: a.isSystem ?? false,
          active: true,
          openingBalance: 0,
          sortKey: a.number,
        })
      }
      await qc.invalidateQueries({ queryKey: ['accounts'] })
    } finally {
      setSeeding(false)
    }
  }

  async function addAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!form.number || !form.name) return
    await createAccount.mutateAsync({
      number: form.number.trim(),
      name: form.name.trim(),
      type: form.type,
      group: form.group.trim() || 'Weitere Konten',
      isSystem: false,
      active: true,
      openingBalance: 0,
      sortKey: form.number.trim(),
    })
    setForm({ number: '', name: '', group: '', type: 'aufwand' })
    setShowNew(false)
  }

  return (
    <>
      <PageHeader
        title="Kontenplan"
        subtitle="Kontenrahmen KMU – Konten anlegen, umbenennen oder deaktivieren."
        actions={
          (accounts?.length ?? 0) > 0 ? (
            <Button onClick={() => setShowNew((v) => !v)}>
              <Plus className="size-4" /> Konto
            </Button>
          ) : null
        }
      />

      {isLoading ? (
        <p className="text-sm text-slate-400">Laden …</p>
      ) : (accounts?.length ?? 0) === 0 ? (
        <EmptyState
          title="Noch kein Kontenplan"
          description="Lade den Standard-Kontenrahmen KMU. Du kannst danach jederzeit Konten ergänzen oder anpassen."
          action={
            <Button onClick={seed} disabled={seeding}>
              {seeding ? 'Wird geladen …' : 'Kontenrahmen KMU laden'}
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {showNew && (
            <Card title="Neues Konto">
              <form onSubmit={addAccount} className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Field label="Nummer">
                  <Input
                    value={form.number}
                    onChange={(e) => setForm({ ...form, number: e.target.value })}
                    placeholder="6620"
                  />
                </Field>
                <Field label="Bezeichnung">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Verpackungsmaterial"
                  />
                </Field>
                <Field label="Typ">
                  <Select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}
                  >
                    {Object.entries(TYPE_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Gruppe">
                  <Input
                    value={form.group}
                    onChange={(e) => setForm({ ...form, group: e.target.value })}
                    placeholder="Übriger Betriebsaufwand"
                  />
                </Field>
                <div className="col-span-2 flex gap-2 md:col-span-4">
                  <Button type="submit">Speichern</Button>
                  <Button type="button" variant="ghost" onClick={() => setShowNew(false)}>
                    Abbrechen
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {grouped.map(([group, list]) => (
            <Card key={group} title={group}>
              <TableWrap>
              <table className="w-full min-w-[520px] text-sm">
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id} className="border-b border-slate-50 last:border-0">
                      <td className="w-16 py-2 font-mono text-slate-500">{a.number}</td>
                      <td className="py-2">
                        <span className={a.active ? '' : 'text-slate-400 line-through'}>
                          {a.name}
                        </span>
                      </td>
                      <td className="w-24 py-2">
                        <Badge tone={TYPE_TONE[a.type]}>{TYPE_LABEL[a.type]}</Badge>
                      </td>
                      <td className="w-40 py-2 text-right">
                        <button
                          className="text-xs text-slate-500 hover:text-slate-800"
                          onClick={() =>
                            updateAccount.mutate({ id: a.id, active: !a.active })
                          }
                        >
                          {a.active ? 'Deaktivieren' : 'Aktivieren'}
                        </button>
                        {!a.isSystem && (
                          <button
                            className="ml-3 text-slate-400 hover:text-red-600"
                            title="Löschen"
                            onClick={() => {
                              if (confirm(`Konto ${a.number} ${a.name} löschen?`))
                                deleteAccount.mutate(a.id)
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
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
