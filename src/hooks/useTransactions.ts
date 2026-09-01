import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Collections,
  createDoc,
  listDocs,
  orderBy,
  patchDoc,
  removeDoc,
  where,
} from '@/lib/db'
import type { Transaction } from '@/lib/types'

export function useTransactions(fiscalYear?: number) {
  return useQuery({
    queryKey: ['transactions', fiscalYear ?? 'all'],
    queryFn: () =>
      listDocs<Transaction>(
        Collections.transactions,
        ...(fiscalYear ? [where('fiscalYear', '==', fiscalYear)] : []),
        orderBy('date', 'desc'),
      ),
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) =>
      createDoc(Collections.transactions, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })
}

export function useUpdateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Transaction> & { id: string }) =>
      patchDoc(Collections.transactions, id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removeDoc(Collections.transactions, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })
}
