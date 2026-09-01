import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Collections, createDoc, listDocs, orderBy, patchDoc, removeDoc } from '@/lib/db'
import type { Note } from '@/lib/types'

export function useNotes() {
  return useQuery({
    queryKey: ['notes'],
    queryFn: async () => {
      const all = await listDocs<Note>(Collections.notes, orderBy('updatedAt', 'desc'))
      return all.sort((a, b) => Number(b.pinned) - Number(a.pinned))
    },
  })
}

export function useCreateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) =>
      createDoc(Collections.notes, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useUpdateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Note> & { id: string }) =>
      patchDoc(Collections.notes, id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removeDoc(Collections.notes, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}
