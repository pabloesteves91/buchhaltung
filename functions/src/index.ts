/**
 * Cloud Functions for the nipponnites accounting app.
 * Region: europe-west6 (Zürich).
 *
 * Secrets are read from Firestore `secrets/*` (written only via the Admin SDK) OR
 * from Firebase Secret Manager. Never expose them to the client.
 */
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { setGlobalOptions } from 'firebase-functions/v2'
import { createHmac, timingSafeEqual } from 'node:crypto'

initializeApp()
const db = getFirestore()
setGlobalOptions({ region: 'europe-west6', maxInstances: 3 })

async function getSecret(key: string): Promise<string | undefined> {
  const snap = await db.doc('secrets/integrations').get()
  return snap.exists ? (snap.data()?.[key] as string | undefined) : undefined
}

/* -------------------------------------------------------------------------- */
/*  Shopify: order webhooks -> shopifyOrders collection                        */
/* -------------------------------------------------------------------------- */

export const shopifyWebhook = onRequest({ cors: false }, async (req, res) => {
  const secret = await getSecret('shopifyWebhookSecret')
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256') ?? ''
  const topic = req.get('X-Shopify-Topic') ?? ''
  const shop = req.get('X-Shopify-Shop-Domain') ?? ''

  if (!secret) {
    res.status(500).send('Shopify secret not configured')
    return
  }

  const digest = createHmac('sha256', secret)
    .update((req as unknown as { rawBody: Buffer }).rawBody)
    .digest('base64')

  const valid =
    digest.length === hmacHeader.length &&
    timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader))

  if (!valid) {
    res.status(401).send('Invalid HMAC')
    return
  }

  const order = req.body as Record<string, unknown>
  const id = String(order.id ?? order.admin_graphql_api_id ?? Date.now())

  await db.doc(`shopifyOrders/${id}`).set(
    {
      raw: order,
      shop,
      topic,
      orderNumber: order.name ?? order.order_number ?? null,
      total: Number(order.total_price ?? 0),
      currency: order.currency ?? 'CHF',
      orderedAt: order.created_at ?? new Date().toISOString(),
      bookingStatus: topic.startsWith('refunds/') ? 'refund_pending' : 'open',
      receivedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  res.status(200).send('ok')
})

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
