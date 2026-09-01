/**
 * Cloud Functions for the nipponnites accounting app.
 * Region: europe-west6 (Zürich).
 */
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'

initializeApp()
const db = getFirestore()
// Drop undefined fields instead of throwing (Shopify payloads have many optionals).
db.settings({ ignoreUndefinedProperties: true })
setGlobalOptions({ region: 'europe-west6', maxInstances: 3 })

async function getSecret(key: string): Promise<string | undefined> {
  const snap = await db.doc('secrets/integrations').get()
  return snap.exists ? (snap.data()?.[key] as string | undefined) : undefined
}

export {
  testShopifyConnection,
  importShopifyOrders,
  importShopifyCustomers,
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
/* Scheduled backup will return in Phase 5 as a manual export button + a
 * schedule once the deploy service account has the Cloud Scheduler role. */
