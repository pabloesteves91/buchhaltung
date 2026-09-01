/**
 * Shopify integration for the nipponnites accounting app.
 *
 * Config lives in Firestore `settings/shopify` (owner-only, written from the app):
 *   shopDomain      "nipponnites.myshopify.com"
 *   clientId        Dev Dashboard app Client-ID
 *   clientSecret    Dev Dashboard app Client-Secret (shpss_… – also signs webhooks)
 *   apiVersion      "2025-01"
 *   autoBook        boolean
 *   createContacts  boolean
 *   accounts        { revenueId, shippingId, feeId, moneyId, refundId }
 *   webhookIds      number[]               (managed by registerShopifyWebhooks)
 *   lastImportAt    ISO string
 */
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { onRequest, onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { createHmac, timingSafeEqual } from 'node:crypto'

const REGION = 'europe-west6'

/** Auth guard + turn any thrown error into a readable HttpsError for the client. */
function guard<T, R>(handler: (req: CallableRequest<T>) => Promise<R>) {
  return async (req: CallableRequest<T>): Promise<R> => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Login required')
    try {
      return await handler(req)
    } catch (e) {
      if (e instanceof HttpsError) throw e
      logger.error('shopify handler failed', e)
      throw new HttpsError(
        'internal',
        e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      )
    }
  }
}

// Lazy — initializeApp() runs in index.ts before any handler fires.
const db = () => getFirestore()

const WEBHOOK_TOPICS = [
  'orders/create',
  'orders/paid',
  'orders/updated',
  'orders/cancelled',
  'refunds/create',
] as const

interface ShopifyConfig {
  shopDomain: string
  /** Dev Dashboard app credentials (client credentials grant). */
  clientId: string
  clientSecret: string
  apiVersion: string
  autoBook: boolean
  createContacts: boolean
  accounts: {
    revenueId?: string
    shippingId?: string
    feeId?: string
    moneyId?: string
    refundId?: string
    bankId?: string
  }
  webhookIds?: number[]
  /** Cached short-lived Admin API token from the client-credentials grant. */
  accessToken?: string
  accessTokenExpiresAt?: number
}

async function getConfig(): Promise<ShopifyConfig> {
  const snap = await db().doc('settings/shopify').get()
  if (!snap.exists) throw new HttpsError('failed-precondition', 'Shopify ist nicht konfiguriert.')
  const d = snap.data() as Partial<ShopifyConfig> & { adminApiToken?: string; apiSecretKey?: string }
  const clientId = d.clientId || ''
  const clientSecret = d.clientSecret || d.apiSecretKey || ''
  if (!d.shopDomain || !clientId || !clientSecret) {
    throw new HttpsError('failed-precondition', 'Shop-Domain, Client-ID oder Client-Secret fehlt.')
  }
  // Shopify only supports roughly the last four quarterly versions; ignore a
  // stale stored value.
  const apiVersion = d.apiVersion && d.apiVersion >= '2025-10' ? d.apiVersion : '2026-07'
  return {
    shopDomain: d.shopDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
    clientId,
    clientSecret,
    apiVersion,
    autoBook: d.autoBook ?? false,
    createContacts: d.createContacts ?? true,
    accounts: d.accounts ?? {},
    webhookIds: d.webhookIds ?? [],
    accessToken: d.accessToken,
    accessTokenExpiresAt: d.accessTokenExpiresAt,
  }
}

/**
 * The Dev Dashboard no longer exposes static Admin API tokens. We exchange the
 * app's client_id / client_secret for a short-lived (24h) token via the client
 * credentials grant and cache it in settings/shopify.
 */
async function getAccessToken(cfg: ShopifyConfig): Promise<string> {
  if (cfg.accessToken && cfg.accessTokenExpiresAt && cfg.accessTokenExpiresAt - Date.now() > 60_000) {
    return cfg.accessToken
  }
  const res = await fetch(`https://${cfg.shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new HttpsError('internal', `Shopify Token-Grant ${res.status}: ${text.slice(0, 300)}`)
  }
  const json = (await res.json()) as { access_token: string; expires_in?: number }
  const expiresAt = Date.now() + (json.expires_in ?? 86400) * 1000
  await db()
    .doc('settings/shopify')
    .set({ accessToken: json.access_token, accessTokenExpiresAt: expiresAt }, { merge: true })
  cfg.accessToken = json.access_token
  cfg.accessTokenExpiresAt = expiresAt
  return json.access_token
}

async function shopifyFetch(
  cfg: ShopifyConfig,
  path: string,
  init: RequestInit = {},
  retriedWithFreshToken = false,
): Promise<Response> {
  const token = await getAccessToken(cfg)
  const url = `https://${cfg.shopDomain}/admin/api/${cfg.apiVersion}${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    // A stale cached token (e.g. after re-authorising with a new scope) — drop it
    // and retry once with a freshly granted token.
    if ((res.status === 401 || res.status === 403) && !retriedWithFreshToken) {
      await db()
        .doc('settings/shopify')
        .set(
          { accessToken: FieldValue.delete(), accessTokenExpiresAt: FieldValue.delete() },
          { merge: true },
        )
      cfg.accessToken = undefined
      cfg.accessTokenExpiresAt = undefined
      return shopifyFetch(cfg, path, init, true)
    }
    throw new HttpsError('internal', `Shopify ${res.status}: ${text.slice(0, 300)}`)
  }
  return res
}

function isoDate(value: string | undefined): string {
  return (value ?? new Date().toISOString()).slice(0, 10)
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

interface ShopifyOrder {
  id: number
  name: string
  order_number: number
  created_at: string
  processed_at?: string
  currency: string
  financial_status: string
  cancelled_at: string | null
  subtotal_price: string
  total_price: string
  total_tax: string
  total_discounts: string
  total_line_items_price?: string
  discount_codes?: { code: string; amount: string; type?: string }[]
  total_shipping_price_set?: { shop_money?: { amount?: string } }
  shipping_lines?: { price: string }[]
  customer?: {
    id: number
    first_name?: string
    last_name?: string
    email?: string
    default_address?: {
      company?: string
      address1?: string
      zip?: string
      city?: string
      country_code?: string
    }
  }
  line_items?: { title: string; quantity: number; price: string }[]
}

function orderSummary(o: ShopifyOrder) {
  const shipping =
    num(o.total_shipping_price_set?.shop_money?.amount) ||
    (o.shipping_lines ?? []).reduce((s, l) => s + num(l.price), 0)
  return {
    orderId: String(o.id),
    orderName: o.name,
    orderNumber: o.order_number,
    orderedAt: o.created_at,
    date: isoDate(o.processed_at || o.created_at),
    currency: o.currency,
    financialStatus: o.financial_status,
    cancelled: Boolean(o.cancelled_at),
    total: num(o.total_price),
    tax: num(o.total_tax),
    shipping,
    goods: num(o.total_price) - shipping,
    discountTotal: num(o.total_discounts),
    discountCodes: (o.discount_codes ?? []).map((d) => d.code).filter(Boolean),
    customerName:
      [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(' ') ||
      o.customer?.default_address?.company ||
      o.customer?.email ||
      'Gast',
    customerEmail: o.customer?.email ?? null,
    shopifyCustomerId: o.customer?.id ? String(o.customer.id) : null,
    lineItems: (o.line_items ?? []).map((l) => ({
      title: l.title,
      quantity: l.quantity,
      price: num(l.price),
    })),
  }
}

/** Create / match a contact for the order's customer. Returns the contact id. */
async function upsertContact(o: ShopifyOrder): Promise<string | null> {
  const c = o.customer
  if (!c) return null
  const cid = String(c.id)

  const byShopify = await db().collection('contacts').where('shopifyCustomerId', '==', cid).limit(1).get()
  if (!byShopify.empty) return byShopify.docs[0].id

  if (c.email) {
    const byEmail = await db().collection('contacts').where('email', '==', c.email).limit(1).get()
    if (!byEmail.empty) {
      await byEmail.docs[0].ref.set({ shopifyCustomerId: cid }, { merge: true })
      return byEmail.docs[0].id
    }
  }

  const a = c.default_address ?? {}
  const company = a.company ?? ''
  const name = company || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'Shopify-Kunde'
  const ref = await db().collection('contacts').add({
    type: 'kunde',
    sortName: name.toLowerCase(),
    company: company || undefined,
    firstName: c.first_name ?? '',
    lastName: c.last_name ?? '',
    email: c.email ?? '',
    address: {
      line1: a.address1 ?? '',
      zip: a.zip ?? '',
      city: a.city ?? '',
      country: (a.country_code ?? 'CH').toUpperCase(),
    },
    language: 'de',
    paymentTermDays: 30,
    tags: ['Shopify'],
    shopifyCustomerId: cid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  return ref.id
}

/** Create the revenue/shipping bookings for one stored order. */
async function bookOrderDoc(orderDocId: string): Promise<void> {
  const cfg = await getConfig()
  const ref = db().doc(`shopifyOrders/${orderDocId}`)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Bestellung nicht gefunden.')
  const s = snap.data() as ReturnType<typeof orderSummary> & { bookingStatus?: string }

  if (s.bookingStatus === 'booked') return
  if (s.cancelled) {
    await ref.set({ bookingStatus: 'cancelled' }, { merge: true })
    return
  }
  const { revenueId, shippingId, moneyId } = cfg.accounts
  if (!revenueId || !moneyId) {
    throw new HttpsError('failed-precondition', 'Erlös- und Geldkonto in den Einstellungen wählen.')
  }

  const txIds: string[] = []
  const base = {
    date: s.date,
    fiscalYear: Number(s.date.slice(0, 4)),
    paymentAccountId: moneyId,
    attachments: [],
    tags: ['Shopify'],
    source: 'shopify' as const,
    shopifyOrderId: s.orderId,
    reconciled: true,
    locked: false,
    kind: 'einnahme' as const,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }

  const goods = Math.round((s.goods + Number.EPSILON) * 100) / 100
  if (goods > 0) {
    const t = await db().collection('transactions').add({
      ...base,
      description: `Shopify ${s.orderName} – ${s.customerName}`,
      amount: goods,
      categoryAccountId: revenueId,
    })
    txIds.push(t.id)
  }
  if (s.shipping > 0 && shippingId) {
    const t = await db().collection('transactions').add({
      ...base,
      description: `Shopify ${s.orderName} – Versand`,
      amount: s.shipping,
      categoryAccountId: shippingId,
    })
    txIds.push(t.id)
  } else if (s.shipping > 0 && !shippingId) {
    // No dedicated shipping account – fold it into revenue.
    const t = await db().collection('transactions').add({
      ...base,
      description: `Shopify ${s.orderName} – Versand`,
      amount: s.shipping,
      categoryAccountId: revenueId,
    })
    txIds.push(t.id)
  }

  await ref.set(
    { bookingStatus: 'booked', bookedTransactionIds: txIds, bookedAt: FieldValue.serverTimestamp() },
    { merge: true },
  )
}

async function bookRefund(orderId: string, amount: number, date: string): Promise<void> {
  const cfg = await getConfig()
  const { refundId, moneyId } = cfg.accounts
  if (!refundId || !moneyId || amount <= 0) return
  await db().collection('transactions').add({
    date,
    fiscalYear: Number(date.slice(0, 4)),
    description: `Shopify Rückerstattung – Bestellung ${orderId}`,
    amount,
    kind: 'ausgabe',
    categoryAccountId: refundId,
    paymentAccountId: moneyId,
    attachments: [],
    tags: ['Shopify', 'Retoure'],
    source: 'shopify',
    shopifyOrderId: orderId,
    reconciled: true,
    locked: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  const ref = db().doc(`shopifyOrders/${orderId}`)
  if ((await ref.get()).exists) {
    await ref.set({ bookingStatus: 'refunded', refundedAt: FieldValue.serverTimestamp() }, { merge: true })
  }
}

async function storeOrder(o: ShopifyOrder, cfg: ShopifyConfig): Promise<void> {
  const summary = orderSummary(o)
  let contactId: string | null = null
  if (cfg.createContacts) {
    try {
      contactId = await upsertContact(o)
    } catch {
      contactId = null
    }
  }
  const ref = db().doc(`shopifyOrders/${summary.orderId}`)
  const existing = await ref.get()
  const prevStatus = existing.exists ? (existing.data()?.bookingStatus as string) : undefined
  await ref.set(
    {
      ...summary,
      contactId,
      raw: o,
      bookingStatus:
        prevStatus && prevStatus !== 'open'
          ? prevStatus
          : summary.cancelled
            ? 'cancelled'
            : 'open',
      receivedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  if (cfg.autoBook && !summary.cancelled && (!prevStatus || prevStatus === 'open')) {
    try {
      await bookOrderDoc(summary.orderId)
    } catch {
      /* leave as open for manual booking */
    }
  }
}

/* ------------------------------- callables -------------------------------- */

export const testShopifyConnection = onCall({ region: REGION }, guard(async () => {
  const cfg = await getConfig()
  const res = await shopifyFetch(cfg, '/shop.json')
  const { shop } = (await res.json()) as { shop: { name: string; myshopify_domain: string; currency: string } }
  return { name: shop.name, domain: shop.myshopify_domain, currency: shop.currency }
}))

export const importShopifyOrders = onCall<{ sinceDays?: number }>({ region: REGION }, guard(async (req) => {
  const cfg = await getConfig()
  const sinceDays = Math.min(Math.max(req.data?.sinceDays ?? 90, 1), 730)
  const since = new Date(Date.now() - sinceDays * 86400_000).toISOString()

  let path: string | null =
    `/orders.json?status=any&limit=250&created_at_min=${encodeURIComponent(since)}`
  let imported = 0
  while (path) {
    const res: Response = await shopifyFetch(cfg, path)
    const { orders } = (await res.json()) as { orders: ShopifyOrder[] }
    for (const o of orders) {
      await storeOrder(o, cfg)
      imported++
    }
    const link = res.headers.get('link') ?? ''
    const next = link.match(/<[^>]*[?&]page_info=([^>&]+)[^>]*>;\s*rel="next"/)
    path = next ? `/orders.json?limit=250&page_info=${next[1]}` : null
  }

  await db().doc('settings/shopify').set({ lastImportAt: new Date().toISOString() }, { merge: true })
  return { imported }
}))

interface ShopifyProduct {
  id: number
  title: string
  status: string
  variants?: { id: number; title: string; price: string; sku?: string }[]
}

/** Import Shopify products/variants into the `products` collection for the
 *  invoice/offer line-item picker. Batched writes so it stays well inside the
 *  callable timeout even with hundreds of variants. */
export const importShopifyProducts = onCall(
  { region: REGION, timeoutSeconds: 300 },
  guard(async () => {
    const cfg = await getConfig()
    let path: string | null = '/products.json?limit=250&status=active'
    let count = 0
    const seen = new Set<string>()
    let batch = db().batch()
    let inBatch = 0
    const flush = async () => {
      if (inBatch > 0) {
        await batch.commit()
        batch = db().batch()
        inBatch = 0
      }
    }

    while (path) {
      const res: Response = await shopifyFetch(cfg, path)
      const { products } = (await res.json()) as { products: ShopifyProduct[] }
      for (const p of products) {
        for (const v of p.variants ?? []) {
          const id = String(v.id)
          seen.add(id)
          const isDefault = !v.title || v.title === 'Default Title'
          batch.set(
            db().doc(`products/${id}`),
            {
              source: 'shopify',
              shopifyProductId: String(p.id),
              shopifyVariantId: id,
              title: isDefault ? p.title : `${p.title} – ${v.title}`,
              sku: v.sku ?? '',
              price: num(v.price),
              unit: 'Stk',
              active: p.status === 'active',
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          )
          count++
          if (++inBatch >= 400) await flush()
        }
      }
      const link = res.headers.get('link') ?? ''
      const next = link.match(/<[^>]*[?&]page_info=([^>&]+)[^>]*>;\s*rel="next"/)
      path = next ? `/products.json?limit=250&page_info=${next[1]}` : null
    }
    await flush()

    // Mark products that vanished from Shopify as inactive.
    const all = await db().collection('products').where('source', '==', 'shopify').get()
    for (const doc of all.docs) {
      if (!seen.has(doc.id)) {
        batch.set(doc.ref, { active: false }, { merge: true })
        if (++inBatch >= 400) await flush()
      }
    }
    await flush()

    return { created: count, updated: 0 }
  }),
)

interface ShopifyCustomer {
  id: number
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  tags?: string
  default_address?: {
    company?: string
    address1?: string
    zip?: string
    city?: string
    country_code?: string
  }
}

/** Import every Shopify customer (also those without an order) into contacts. */
export const importShopifyCustomers = onCall({ region: REGION }, guard(async () => {
  const cfg = await getConfig()

  const existing = await db().collection('contacts').get()
  const byShopifyId = new Map<string, string>()
  const byEmail = new Map<string, string>()
  for (const doc of existing.docs) {
    const d = doc.data()
    if (d.shopifyCustomerId) byShopifyId.set(String(d.shopifyCustomerId), doc.id)
    if (d.email) byEmail.set(String(d.email).toLowerCase(), doc.id)
  }

  let path: string | null = '/customers.json?limit=250'
  let created = 0
  let updated = 0
  while (path) {
    const res: Response = await shopifyFetch(cfg, path)
    const { customers } = (await res.json()) as { customers: ShopifyCustomer[] }
    for (const c of customers) {
      const cid = String(c.id)
      const email = (c.email ?? '').toLowerCase()
      const a = c.default_address ?? {}
      const company = a.company ?? ''
      const name =
        company || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'Shopify-Kunde'
      const payload = {
        type: 'kunde',
        sortName: name.toLowerCase(),
        company: company || undefined,
        firstName: c.first_name ?? '',
        lastName: c.last_name ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        address: {
          line1: a.address1 ?? '',
          zip: a.zip ?? '',
          city: a.city ?? '',
          country: (a.country_code ?? 'CH').toUpperCase(),
        },
        language: 'de',
        paymentTermDays: 30,
        tags: ['Shopify'],
        shopifyCustomerId: cid,
        updatedAt: FieldValue.serverTimestamp(),
      }
      const hitId = byShopifyId.get(cid) ?? (email ? byEmail.get(email) : undefined)
      if (hitId) {
        await db().doc(`contacts/${hitId}`).set(payload, { merge: true })
        updated++
      } else {
        await db()
          .collection('contacts')
          .add({ ...payload, createdAt: FieldValue.serverTimestamp() })
        created++
      }
    }
    const link = res.headers.get('link') ?? ''
    const next = link.match(/<[^>]*[?&]page_info=([^>&]+)[^>]*>;\s*rel="next"/)
    path = next ? `/customers.json?limit=250&page_info=${next[1]}` : null
  }

  return { created, updated }
}))

interface PayoutTx {
  type: string
  amount: string
  fee: string
  net: string
}

/** Import Shopify Payments payouts + their fee breakdown. */
export const importShopifyPayouts = onCall<{ sinceDays?: number }>(
  { region: REGION },
  guard(async (req) => {
    const cfg = await getConfig()
    const sinceDays = Math.min(Math.max(req.data?.sinceDays ?? 180, 1), 730)
    const since = new Date(Date.now() - sinceDays * 86400_000).toISOString().slice(0, 10)

    let path: string | null =
      `/shopify_payments/payouts.json?limit=250&date_min=${since}`
    let imported = 0
    while (path) {
      const res: Response = await shopifyFetch(cfg, path)
      const { payouts } = (await res.json()) as {
        payouts: { id: number; date: string; status: string; amount: string; currency: string }[]
      }
      for (const p of payouts) {
        // Fee / gross breakdown from the balance transactions of this payout.
        let fees = 0
        let gross = 0
        let refunds = 0
        let adjustments = 0
        let txPath: string | null =
          `/shopify_payments/balance/transactions.json?payout_id=${p.id}&limit=250`
        while (txPath) {
          const txRes: Response = await shopifyFetch(cfg, txPath)
          const { transactions } = (await txRes.json()) as { transactions: PayoutTx[] }
          for (const t of transactions) {
            fees += num(t.fee)
            if (t.type === 'charge') gross += num(t.amount)
            else if (t.type === 'refund') refunds += num(t.amount)
            else if (t.type === 'adjustment' || t.type === 'dispute') adjustments += num(t.amount)
          }
          const link = txRes.headers.get('link') ?? ''
          const next = link.match(/<[^>]*[?&]page_info=([^>&]+)[^>]*>;\s*rel="next"/)
          txPath = next
            ? `/shopify_payments/balance/transactions.json?limit=250&page_info=${next[1]}`
            : null
        }
        const ref = db().doc(`shopifyPayouts/${p.id}`)
        const existing = await ref.get()
        await ref.set(
          {
            payoutId: String(p.id),
            date: p.date,
            status: p.status,
            currency: p.currency,
            net: num(p.amount),
            gross: Math.round(gross * 100) / 100,
            fees: Math.round(Math.abs(fees) * 100) / 100,
            refunds: Math.round(Math.abs(refunds) * 100) / 100,
            adjustments: Math.round(adjustments * 100) / 100,
            bookingStatus: existing.exists ? existing.data()?.bookingStatus ?? 'open' : 'open',
            receivedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
        imported++
      }
      const link = res.headers.get('link') ?? ''
      const next = link.match(/<[^>]*[?&]page_info=([^>&]+)[^>]*>;\s*rel="next"/)
      path = next ? `/shopify_payments/payouts.json?limit=250&page_info=${next[1]}` : null
    }
    return { imported }
  }),
)

export const bookShopifyOrder = onCall<{ orderId: string | string[] }>({ region: REGION }, guard(async (req) => {
  const ids = Array.isArray(req.data.orderId) ? req.data.orderId : [req.data.orderId]
  for (const id of ids) await bookOrderDoc(id)
  return { booked: ids.length }
}))

export const unbookShopifyOrder = onCall<{ orderId: string }>({ region: REGION }, guard(async (req) => {
  const ref = db().doc(`shopifyOrders/${req.data.orderId}`)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Bestellung nicht gefunden.')
  const txIds = (snap.data()?.bookedTransactionIds as string[]) ?? []
  await Promise.all(txIds.map((id) => db().doc(`transactions/${id}`).delete().catch(() => {})))
  await ref.set(
    { bookingStatus: 'open', bookedTransactionIds: FieldValue.delete(), bookedAt: FieldValue.delete() },
    { merge: true },
  )
  return { ok: true }
}))

export const registerShopifyWebhooks = onCall({ region: REGION }, guard(async () => {
  const cfg = await getConfig()
  const project = process.env.GCLOUD_PROJECT
  const address = `https://europe-west6-${project}.cloudfunctions.net/shopifyWebhook`

  // Remove our previous webhooks, then re-create.
  for (const id of cfg.webhookIds ?? []) {
    await shopifyFetch(cfg, `/webhooks/${id}.json`, { method: 'DELETE' }).catch(() => {})
  }

  const ids: number[] = []
  for (const topic of WEBHOOK_TOPICS) {
    const res = await shopifyFetch(cfg, '/webhooks.json', {
      method: 'POST',
      body: JSON.stringify({ webhook: { topic, address, format: 'json' } }),
    })
    const { webhook } = (await res.json()) as { webhook: { id: number } }
    ids.push(webhook.id)
  }
  await db().doc('settings/shopify').set({ webhookIds: ids, webhooksAddress: address }, { merge: true })
  return { registered: ids.length, address }
}))

/* -------------------------------- webhook -------------------------------- */

export const shopifyWebhook = onRequest({ cors: false, region: REGION }, async (req, res) => {
  const cfg = await getConfig().catch(() => null)
  const secret = cfg?.clientSecret
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256') ?? ''
  const topic = req.get('X-Shopify-Topic') ?? ''

  if (!cfg || !secret) {
    res.status(503).send('Shopify not configured')
    return
  }

  const digest = createHmac('sha256', secret)
    .update((req as unknown as { rawBody: Buffer }).rawBody)
    .digest('base64')
  const ok =
    digest.length === hmacHeader.length &&
    timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader))
  if (!ok) {
    res.status(401).send('Invalid HMAC')
    return
  }

  try {
    if (topic === 'refunds/create') {
      const refund = req.body as {
        order_id: number
        created_at?: string
        transactions?: { amount: string; kind: string }[]
      }
      const amount = (refund.transactions ?? [])
        .filter((t) => t.kind === 'refund')
        .reduce((s, t) => s + num(t.amount), 0)
      if (cfg.autoBook) await bookRefund(String(refund.order_id), amount, isoDate(refund.created_at))
      else {
        await db().doc(`shopifyOrders/${refund.order_id}`).set(
          { bookingStatus: 'refund_pending', pendingRefund: amount },
          { merge: true },
        )
      }
    } else {
      await storeOrder(req.body as ShopifyOrder, cfg)
    }
    res.status(200).send('ok')
  } catch (err) {
    console.error('shopifyWebhook', err)
    res.status(200).send('stored-with-errors')
  }
})
