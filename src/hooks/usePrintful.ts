import { useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { callable } from '@/hooks/useShopify'

/** Config lives in Firestore `settings/printful` (owner-only, same pattern as
 *  `settings/shopify`). Only the API key is a secret; it's entered once via
 *  the app and never leaves the client except inside the Cloud Function call. */
export interface PrintfulConfig {
  apiKey?: string
  connected?: boolean
  storeName?: string
  lastImportAt?: string
}

const configRef = () => doc(db, 'settings', 'printful')

export function usePrintfulConfig() {
  const [config, setConfig] = useState<PrintfulConfig | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    return onSnapshot(configRef(), (snap) => {
      setConfig(snap.exists() ? (snap.data() as PrintfulConfig) : {})
      setLoading(false)
    })
  }, [])
  return { config, loading }
}

export function useSavePrintfulConfig() {
  return useMutation({
    mutationFn: async (patch: Partial<PrintfulConfig>) => {
      await setDoc(configRef(), { ...patch, updatedAt: serverTimestamp() }, { merge: true })
    },
  })
}

export function usePrintfulActions() {
  const qc = useQueryClient()
  return {
    test: useMutation({
      mutationFn: callable<Record<string, never>, { name: string }>('testPrintfulConnection'),
      onSuccess: (r) => void setDoc(configRef(), { connected: true, storeName: r.name }, { merge: true }),
    }),
    importCosts: useMutation({
      mutationFn: callable<{ sinceDays: number }, { updated: number; skipped: number }>(
        'importPrintfulCosts',
      ),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['shopifyOrders'] }),
    }),
  }
}
