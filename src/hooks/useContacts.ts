import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Collections,
  createDoc,
  listDocs,
  orderBy,
  patchDoc,
  removeDoc,
} from '@/lib/db'
import type { Contact } from '@/lib/types'

export function contactName(c: Pick<Contact, 'company' | 'firstName' | 'lastName'>): string {
  if (c.company) return c.company
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Ohne Namen'
}

export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: () => listDocs<Contact>(Collections.contacts, orderBy('sortName')),
  })
}

export function useCreateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) =>
      createDoc(Collections.contacts, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  })
}

export function useUpdateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Contact> & { id: string }) =>
      patchDoc(Collections.contacts, id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  })
}

export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removeDoc(Collections.contacts, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  })
}
