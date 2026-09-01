/**
 * Cloud Functions for the nipponnites accounting app.
 * Region: europe-west6 (Zürich).
 */
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { setGlobalOptions } from 'firebase-functions/v2'

initializeApp()
const db = getFirestore()
setGlobalOptions({ region: 'europe-west6', maxInstances: 3 })

async function getSecret(key: string): Promise<string | undefined> {
  const snap = await db.doc('secrets/integrations').get()
  return snap.exists ? (snap.data()?.[key] as string | undefined) : undefined
}

export {
  testShopifyConnection,
  importShopifyOrders,
  bookShopifyOrder,
  unbookShopifyOrder,
  registerShopifyWebhooks,
  shopifyWebhook,
} from './shopify.js'

/* -------------------------------------------------------------------------- */
/*  Email: send a generated document PDF via Resend                            */
/* -------------------------------------------------------------------------- */

interface SendDocInput {
  documentId: string
  to: string
  subject: string
  body: string
  pdfStoragePath: string
}

export const sendDocumentEmail = onCall<SendDocInput>(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required')

  const resendKey = await getSecret('resendApiKey')
  const fromAddress = await getSecret('mailFrom')
  if (!resendKey || !fromAddress) {
    throw new HttpsError('failed-precondition', 'E-Mail-Versand ist noch nicht konfiguriert.')
  }

  const { documentId, to, subject, body, pdfStoragePath } = request.data
  const bucket = (await import('firebase-admin/storage')).getStorage().bucket()
  const [pdf] = await bucket.file(pdfStoragePath).download()

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to,
      subject,
      text: body,
      attachments: [{ filename: `${documentId}.pdf`, content: pdf.toString('base64') }],
    }),
  })

  if (!resp.ok) {
    throw new HttpsError('internal', `Resend: ${resp.status} ${await resp.text()}`)
  }

  await db.doc(`documents/${documentId}`).set(
    { status: 'versendet', sentAt: new Date().toISOString(), sentTo: to },
    { merge: true },
  )

  return { ok: true }
})

/* -------------------------------------------------------------------------- */
/*  Weekly backup: export all collections to a JSON file in Storage            */
/* -------------------------------------------------------------------------- */

const BACKUP_COLLECTIONS = [
  'accounts',
  'transactions',
  'contacts',
  'documents',
  'notes',
  'fiscalYears',
  'shopifyOrders',
]

export const weeklyBackup = onSchedule('every monday 03:00', async () => {
  const dump: Record<string, unknown[]> = {}
  for (const name of BACKUP_COLLECTIONS) {
    const snap = await db.collection(name).get()
    dump[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  }
  const settings = await db.doc('settings/company').get()
  dump.settings = settings.exists ? [settings.data()] : []

  const bucket = (await import('firebase-admin/storage')).getStorage().bucket()
  const path = `backups/backup-${new Date().toISOString().slice(0, 10)}.json`
  await bucket.file(path).save(JSON.stringify(dump, null, 2), {
    contentType: 'application/json',
  })
  await db.collection('backups').add({
    path,
    createdAt: FieldValue.serverTimestamp(),
    collections: Object.keys(dump),
  })
})
