import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { settingsRef } from '@/lib/db'
import type { CompanySettings } from '@/lib/types'
import type { DocumentType } from '@/lib/types'

export const DEFAULT_SETTINGS: CompanySettings = {
  name: 'nipponnites',
  legalForm: 'Einzelunternehmen',
  address: { line1: '', zip: '', city: '', country: 'CH' },
  email: '',
  taxMode: 'none',
  currency: 'CHF',
  fiscalYearStartMonth: 1,
  bank: {},
  invoice: {
    defaultPaymentTermDays: 30,
    numberPrefix: {
      offerte: 'OF-',
      auftragsbestaetigung: 'AB-',
      rechnung: 'RE-',
      gutschrift: 'GS-',
      lieferschein: 'LS-',
    } as Record<DocumentType, string>,
    footerText: 'Besten Dank für Ihren Einkauf bei nipponnites.',
    defaultIntroText: '',
    defaultOutroText: '',
    accentColor: '#1f47db',
  },
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<CompanySettings> => {
      const snap = await getDoc(settingsRef())
      if (!snap.exists()) return DEFAULT_SETTINGS
      return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<CompanySettings>) }
    },
  })
}

export function useSaveSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: CompanySettings) => {
      await setDoc(settingsRef(), { ...data, updatedAt: serverTimestamp() }, { merge: true })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}
