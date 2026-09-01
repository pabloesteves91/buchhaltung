import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Collections,
  createDoc,
  listDocs,
  orderBy,
  patchDoc,
  removeDoc,
} from '@/lib/db'
import type { Account } from '@/lib/types'

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => listDocs<Account>(Collections.accounts, orderBy('number')),
  })
}

export function useAccountMap() {
  const { data } = useAccounts()
  const map = new Map<string, Account>()
  for (const a of data ?? []) map.set(a.id, a)
  return map
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) =>
      createDoc(Collections.accounts, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Account> & { id: string }) =>
      patchDoc(Collections.accounts, id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removeDoc(Collections.accounts, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}
