import type { BusinessDocument, CompanySettings, Contact } from './types'
import { contactName } from '@/hooks/useContacts'
import type { ShopifyOrderDoc } from '@/hooks/useShopify'
import { round2 } from './format'

export function orderIsPaid(order: ShopifyOrderDoc): boolean {
  return order.financialStatus === 'paid' || order.financialStatus === 'partially_refunded'
}

/** Discount info, falling back to the raw Shopify payload for orders imported
 *  before discounts were captured. */
export function orderDiscount(order: ShopifyOrderDoc): { total: number; codes: string[] } {
  if (order.discountTotal !== undefined) {
    return { total: order.discountTotal, codes: order.discountCodes ?? [] }
  }
  const raw = order.raw as
    | { total_discounts?: string; discount_codes?: { code?: string }[] }
    | undefined
  return {
    total: Math.round(Number(raw?.total_discounts ?? 0) * 100) / 100,
    codes: (raw?.discount_codes ?? []).map((d) => d.code ?? '').filter(Boolean),
  }
}

/**
 * Build a read-only BusinessDocument from a Shopify order so it can be rendered
 * with the normal invoice PDF template. Never stored — recomputed on demand.
 */
export function orderToDocument(
  order: ShopifyOrderDoc,
  contact: Contact | undefined,
  settings: CompanySettings,
): BusinessDocument {
  const lineItems = order.lineItems.map((li, i) => ({
    id: `li-${i}`,
    description: li.title,
    quantity: li.quantity,
    unit: 'Stk',
    unitPrice: li.price,
    discountPct: 0,
  }))
  if (order.shipping > 0) {
    lineItems.push({
      id: 'shipping',
      description: 'Versand',
      quantity: 1,
      unit: 'Pausch.',
      unitPrice: round2(order.shipping),
      discountPct: 0,
    })
  }

  const paid = orderIsPaid(order)
  const { total: discountTotal, codes: discountCodes } = orderDiscount(order)
  const grossLineItems = lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0)
  const address = contact
    ? [
        contact.address.line1,
        contact.address.line2,
        `${contact.address.zip ?? ''} ${contact.address.city ?? ''}`.trim(),
        contact.address.country && contact.address.country !== 'CH' ? contact.address.country : '',
      ].filter(Boolean)
    : []

  return {
    id: order.id,
    type: 'rechnung',
    number: order.orderName,
    contactId: order.contactId ?? '',
    recipientSnapshot: {
      name: contact ? contactName(contact) : order.customerName,
      address: address as string[],
      street: contact?.address.line1,
      zip: contact?.address.zip,
      city: contact?.address.city,
      country: contact?.address.country ?? 'CH',
      email: contact?.email ?? order.customerEmail ?? undefined,
      language: contact?.language ?? 'de',
    },
    date: order.date,
    dueDate: paid ? undefined : order.date,
    fiscalYear: Number(order.date.slice(0, 4)),
    currency: 'CHF',
    lineItems,
    globalDiscountPct: 0,
    subtotal: round2(discountTotal > 0 ? grossLineItems : order.goods + order.shipping),
    discountTotal: round2(discountTotal),
    total: round2(order.total),
    roundingDelta: 0,
    status: paid ? 'bezahlt' : 'versendet',
    payments: paid
      ? [
          {
            id: 'shopify',
            date: order.date,
            amount: round2(order.total),
            method: 'Shopify',
          },
        ]
      : [],
    introText: settings.invoice.defaultIntroText || undefined,
    outroText: [
      discountCodes.length > 0 ? `Rabattcode: ${discountCodes.join(', ')}` : '',
      paid
        ? `Betrag dankend erhalten – bezahlt via Shopify (Bestellung ${order.orderName}).`
        : settings.invoice.defaultOutroText || '',
    ]
      .filter(Boolean)
      .join('\n') || undefined,
    templateId: 'default',
    dunningLevel: 0,
  }
}
