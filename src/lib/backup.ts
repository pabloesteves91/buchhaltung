import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Collections, listDocs, settingsRef } from '@/lib/db'

const COLLECTIONS = [
  Collections.accounts,
  Collections.transactions,
  Collections.contacts,
  Collections.documents,
  Collections.notes,
  Collections.fiscalYears,
  Collections.shopifyOrders,
  Collections.numberSequences,
] as const

/** Full data export as a single JSON file (everything except generated PDFs). */
export async function exportAllData(): Promise<Blob> {
  const dump: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    app: 'nipponnites-buchhaltung',
  }
  for (const name of COLLECTIONS) {
    dump[name] = await listDocs(name)
  }
  const company = await getDoc(settingsRef())
  const shopify = await getDoc(doc(db, 'settings', 'shopify'))
  let shopifyExport: Record<string, unknown> | null = null
  if (shopify.exists()) {
    shopifyExport = { ...(shopify.data() as Record<string, unknown>) }
    // Never export the Shopify secret / access token.
    delete shopifyExport.clientSecret
    delete shopifyExport.accessToken
  }
  dump.settings = {
    company: company.exists() ? company.data() : null,
    shopify: shopifyExport,
  }
  return new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
