import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Collections,
  createDoc,
  listDocs,
  orderBy,
  patchDoc,
  removeDoc,
} from '@/lib/db'
import type { Product } from '@/lib/types'

export function useProducts(opts: { activeOnly?: boolean } = {}) {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const all = await listDocs<Product>(Collections.products, orderBy('title'))
      return opts.activeOnly ? all.filter((p) => p.active) : all
    },
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) =>
      createDoc(Collections.products, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Product> & { id: string }) =>
      patchDoc(Collections.products, id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removeDoc(Collections.products, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}
