import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Collections, listDocs, upsertDoc } from '@/lib/db'
import type { FiscalYear } from '@/lib/types'

export function useFiscalYears() {
  return useQuery({
    queryKey: ['fiscalYears'],
    queryFn: () => listDocs<FiscalYear>(Collections.fiscalYears),
  })
}

export function useSaveFiscalYear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fy: FiscalYear) => upsertDoc(Collections.fiscalYears, String(fy.year), fy),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscalYears'] }),
  })
}

/** The latest lock date across all closed years, or null. */
export function lockDate(fiscalYears: FiscalYear[] | undefined): string | null {
  const locks = (fiscalYears ?? [])
    .filter((f) => f.status === 'abgeschlossen' && f.lockedThrough)
    .map((f) => f.lockedThrough as string)
  return locks.length ? locks.sort().at(-1)! : null
}

export function isDateLocked(date: string, fiscalYears: FiscalYear[] | undefined): boolean {
  const lock = lockDate(fiscalYears)
  return lock ? date <= lock : false
}
