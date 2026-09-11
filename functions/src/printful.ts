/**
 * Printful integration – pulls real fulfillment costs (COGS) per Shopify
 * order so the accounting app can show actual margin, not just revenue.
 *
 * Config lives in Firestore `settings/printful` (owner-only, written from the
 * app – same pattern as `settings/shopify`):
 *   apiKey        Printful API token (Bearer auth, does not expire like a
 *                 Shopify access token, so no refresh logic is needed here)
 *   connected     boolean, set after a successful test
 *   storeName     cached for display
 *   lastImportAt  ISO string
 *
 * Cost data is stored on the Shopify order document at the ORDER level
 * (`shopifyOrders/{id}.cogs`), not per line item: Shopify line items carry no
 * SKU/variant id in this app's schema, so a reliable per-item match to
 * Printful's cost breakdown isn't possible today.
 */
import { getFirestore } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { guard, num } from './shopify.js'

const REGION = 'europe-west6'
const API_BASE = 'https://api.printful.com'

const db = () => getFirestore()

interface PrintfulConfig {
  apiKey: string
}

async function getConfig(): Promise<PrintfulConfig> {
  const snap = await db().doc('settings/printful').get()
  const apiKey = (snap.data()?.apiKey as string | undefined) || ''
  if (!apiKey) throw new HttpsError('failed-precondition', 'Printful ist nicht konfiguriert.')
  return { apiKey }
}

async function printfulFetch(cfg: PrintfulConfig, path: string): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new HttpsError('internal', `Printful ${res.status}: ${text.slice(0, 300)}`)
  }
  return res
}

export const testPrintfulConnection = onCall(
  { region: REGION },
  guard(async () => {
    const cfg = await getConfig()
    // /store needs a "stores_list/read" scope that per-store tokens don't
    // grant. /orders?limit=1 only needs "orders/read", which every token
    // used for cost-import already has, so it doubles as a connection test.
    const res = await printfulFetch(cfg, '/orders?limit=1')
    const { paging } = (await res.json()) as { paging?: { total: number } }
    return { orderCount: paging?.total ?? 0 }
  }),
)

interface PrintfulOrderSummary {
  id: number
  external_id: string | null
}

interface PrintfulOrderDetail {
  id: number
  external_id: string | null
  costs?: {
    subtotal: string
    shipping: string
    total: string
  }
}

/**
 * Match Printful orders (by `external_id`) to Shopify orders that don't have
 * `cogs` yet, and store the fulfillment cost total on each. `external_id` is
 * whatever the Shopify↔Printful connection stored when the order was created
 * there – normally the Shopify order id, sometimes the order name/number.
 * Verify this matches against real data on the first run; if it doesn't,
 * fall back to manual cost entry rather than spending more time guessing the
 * exact field Printful used for a given store's integration.
 */
export const importPrintfulCosts = onCall(
  { region: REGION, timeoutSeconds: 300 },
  guard(async (req: import('firebase-functions/v2/https').CallableRequest<{ sinceDays?: number }>) => {
    const cfg = await getConfig()
    const sinceDays = req.data?.sinceDays ?? 90
    const sinceIso = new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 10)

    // Shopify orders in range that still need a cost figure.
    const ordersSnap = await db()
      .collection('shopifyOrders')
      .where('date', '>=', sinceIso)
      .get()
    const candidates = ordersSnap.docs.filter((d) => !d.data().cogs)
    if (candidates.length === 0) return { updated: 0, skipped: 0 }

    // Build a lookup of Printful external_id -> Printful order id by paging
    // through the order list (the list endpoint doesn't include `costs`).
    const byExternalId = new Map<string, number>()
    let offset = 0
    for (let page = 0; page < 20; page++) {
      const res = await printfulFetch(cfg, `/orders?limit=100&offset=${offset}`)
      const body = (await res.json()) as { result: PrintfulOrderSummary[]; paging?: { total: number } }
      for (const o of body.result) {
        if (o.external_id) byExternalId.set(String(o.external_id), o.id)
      }
      offset += 100
      if (!body.paging || offset >= body.paging.total || body.result.length === 0) break
    }

    let updated = 0
    let skipped = 0
    for (const doc of candidates) {
      const order = doc.data() as { orderId: string; orderName: string }
      const printfulId =
        byExternalId.get(String(order.orderId)) ??
        byExternalId.get(order.orderName) ??
        byExternalId.get(order.orderName.replace(/^#/, ''))
      if (!printfulId) {
        skipped++
        continue
      }
      try {
        const detailRes = await printfulFetch(cfg, `/orders/${printfulId}`)
        const { result } = (await detailRes.json()) as { result: PrintfulOrderDetail }
        if (!result.costs) {
          skipped++
          continue
        }
        const shipping = num(result.costs.shipping)
        const total = num(result.costs.total)
        await doc.ref.set(
          { cogs: { product: num(total - shipping), shipping, total, source: 'printful' } },
          { merge: true },
        )
        updated++
      } catch (e) {
        logger.warn(`Printful order ${printfulId} konnte nicht geladen werden`, e)
        skipped++
      }
    }

    await db().doc('settings/printful').set({ lastImportAt: new Date().toISOString() }, { merge: true })
    return { updated, skipped }
  }),
)
