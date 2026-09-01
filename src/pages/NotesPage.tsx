import { useState } from 'react'
import { Pin, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, EmptyState, Field, Input, Modal, Textarea } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useCreateNote, useDeleteNote, useNotes, useUpdateNote } from '@/hooks/useNotes'
import type { Note } from '@/lib/types'

export function NotesPage() {
  const { data: notes, isLoading } = useNotes()
  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()

  const [editing, setEditing] = useState<Note | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', pinned: false })

  function openNew() {
    setEditing(null)
    setForm({ title: '', body: '', pinned: false })
    setOpen(true)
  }
  function openEdit(n: Note) {
    setEditing(n)
    setForm({ title: n.title, body: n.body, pinned: n.pinned })
    setOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() && !form.body.trim()) return
    if (editing) await updateNote.mutateAsync({ id: editing.id, ...form })
    else await createNote.mutateAsync({ ...form })
    setOpen(false)
  }

  return (
    <>
      <PageHeader
        title="Notizen"
        subtitle="Freie Notizen – angepinnte zuerst."
        actions={
          <Button onClick={openNew}>
            <Plus className="size-4" /> Notiz
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-sm text-slate-400">Laden …</p>
      ) : (notes?.length ?? 0) === 0 ? (
        <EmptyState
          title="Noch keine Notizen"
          description="Halte hier fest, was du dir merken willst – Steuertermine, offene Fragen, To-dos."
          action={<Button onClick={openNew}>Notiz erstellen</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes!.map((n) => (
            <Card key={n.id} className={cn(n.pinned && 'border-brand-300')}>
              <button className="w-full text-left" onClick={() => openEdit(n)}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-800">{n.title || 'Ohne Titel'}</p>
                  {n.pinned && <Pin className="size-3.5 shrink-0 text-brand-500" />}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 line-clamp-6">
                  {n.body}
                </p>
              </button>
              <div className="mt-2 flex items-center justify-between">
                <button
                  className="text-xs text-slate-400 hover:text-brand-600"
                  onClick={() => updateNote.mutate({ id: n.id, pinned: !n.pinned })}
                >
                  {n.pinned ? 'Lösen' : 'Anpinnen'}
                </button>
                <button
                  className="text-slate-300 hover:text-red-600"
                  onClick={() => {
                    if (confirm('Notiz löschen?')) deleteNote.mutate(n.id)
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Notiz bearbeiten' : 'Neue Notiz'}>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Titel">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Text">
            <Textarea
              rows={8}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
            />
            Anpinnen
          </label>
          <div className="flex gap-2">
            <Button type="submit">Speichern</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
