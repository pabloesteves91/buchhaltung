import { Collections, createDoc, patchDoc, removeDoc } from './db'
import { round2 } from './format'
import type { ShopifyConfig, ShopifyOrderDoc } from '@/hooks/useShopify'
import type { Transaction } from './types'

/**
 * Create the revenue (+ shipping) bookings for a Shopify order, client-side.
 * Mirrors the server-side logic in functions/src/shopify.ts so booking works
 * even before Cloud Functions are deployed and for CSV-imported orders.
 */
export async function bookShopifyOrderLocal(
  order: ShopifyOrderDoc,
  cfg: ShopifyConfig,
): Promise<void> {
  if (order.bookingStatus === 'booked') return
  const acc = cfg.accounts ?? {}
  if (!acc.revenueId || !acc.moneyId) {
    throw new Error('Bitte zuerst Erlös- und Geldkonto in der Kontozuordnung wählen.')
  }

  const base: Omit<Transaction, 'id' | 'description' | 'amount' | 'categoryAccountId'> = {
    date: order.date,
    fiscalYear: Number(order.date.slice(0, 4)),
    kind: 'einnahme',
    paymentAccountId: acc.moneyId,
    attachments: [],
    tags: ['Shopify'],
    source: 'shopify',
    shopifyOrderId: order.orderId,
    reconciled: true,
    locked: false,
  }

  const txIds: string[] = []
  const goods = round2(order.goods)
  if (goods > 0) {
    txIds.push(
      await createDoc(Collections.transactions, {
        ...base,
        description: `Shopify ${order.orderName} – ${order.customerName}`,
        amount: goods,
        categoryAccountId: acc.revenueId,
      }),
    )
  }
  if (order.shipping > 0) {
    txIds.push(
      await createDoc(Collections.transactions, {
        ...base,
        description: `Shopify ${order.orderName} – Versand`,
        amount: round2(order.shipping),
        categoryAccountId: acc.shippingId || acc.revenueId,
      }),
    )
  }

  await patchDoc(Collections.shopifyOrders, order.id, {
    bookingStatus: 'booked',
    bookedTransactionIds: txIds,
  })
}

export async function unbookShopifyOrderLocal(order: ShopifyOrderDoc): Promise<void> {
  for (const id of order.bookedTransactionIds ?? []) {
    await removeDoc(Collections.transactions, id).catch(() => {})
  }
  await patchDoc(Collections.shopifyOrders, order.id, {
    bookingStatus: 'open',
    bookedTransactionIds: [],
  })
}
