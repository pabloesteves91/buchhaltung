import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { doc, runTransaction } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  Collections,
  createDoc,
  getOne,
  listDocs,
  orderBy,
  patchDoc,
  removeDoc,
} from '@/lib/db'
import type { BusinessDocument, DocumentType } from '@/lib/types'

const TYPE_ORDER: DocumentType[] = [
  'offerte',
  'auftragsbestaetigung',
  'rechnung',
  'gutschrift',
  'lieferschein',
]

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  offerte: 'Offerte',
  auftragsbestaetigung: 'Auftragsbestätigung',
  rechnung: 'Rechnung',
  gutschrift: 'Gutschrift',
  lieferschein: 'Lieferschein',
}

export function useDocuments(type?: DocumentType) {
  return useQuery({
    queryKey: ['documents', type ?? 'all'],
    queryFn: async () => {
      const all = await listDocs<BusinessDocument>(
        Collections.documents,
        orderBy('date', 'desc'),
      )
      const filtered = type ? all.filter((d) => d.type === type) : all
      return filtered.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1
        return TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)
      })
    },
  })
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => (id ? getOne<BusinessDocument>(Collections.documents, id) : null),
    enabled: !!id,
  })
}

/**
 * Gapless per-type, per-year numbering. Runs in a Firestore transaction so two
 * tabs can't grab the same number. Format: <prefix><YY>-<0001>.
 */
export async function nextDocumentNumber(
  type: DocumentType,
  fiscalYear: number,
  prefix: string,
): Promise<string> {
  const seqRef = doc(db, Collections.numberSequences, `${type}_${fiscalYear}`)
  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(seqRef)
    const current = snap.exists() ? (snap.data().value as number) : 0
    const value = current + 1
    tx.set(seqRef, { type, fiscalYear, value }, { merge: true })
    return value
  })
  const yy = String(fiscalYear).slice(2)
  return `${prefix}${yy}-${String(next).padStart(4, '0')}`
}

export function useCreateDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<BusinessDocument, 'id' | 'createdAt' | 'updatedAt'>) =>
      createDoc(Collections.documents, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })
}

export function useUpdateDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<BusinessDocument> & { id: string }) =>
      patchDoc(Collections.documents, id, patch),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['documents'] })
      qc.invalidateQueries({ queryKey: ['document', vars.id] })
    },
  })
}

export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removeDoc(Collections.documents, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })
}
