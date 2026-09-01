import type { BusinessDocument, DocumentType, LineItem } from './types'
import { round2, roundRappen } from './format'

export function lineNet(item: LineItem): number {
  const gross = item.quantity * item.unitPrice
  return round2(gross * (1 - (item.discountPct || 0) / 100))
}

export interface DocumentTotals {
  subtotal: number
  discountTotal: number
  total: number
  roundingDelta: number
}

/** Invoices get 5-Rappen rounding; offers/other documents are shown exact. */
export function computeTotals(
  lineItems: LineItem[],
  globalDiscountPct: number,
  type: DocumentType,
): DocumentTotals {
  const subtotal = round2(lineItems.reduce((sum, it) => sum + lineNet(it), 0))
  const afterGlobal = round2(subtotal * (1 - (globalDiscountPct || 0) / 100))
  const discountTotal = round2(subtotal - afterGlobal)
  const total = type === 'rechnung' ? roundRappen(afterGlobal) : afterGlobal
  const roundingDelta = round2(total - afterGlobal)
  return { subtotal, discountTotal, total, roundingDelta }
}

export function amountPaid(doc: Pick<BusinessDocument, 'payments'>): number {
  return round2(doc.payments.reduce((s, p) => s + p.amount, 0))
}

export function openAmount(doc: BusinessDocument): number {
  return round2(doc.total - amountPaid(doc))
}

export function newLineItem(): LineItem {
  return {
    id: crypto.randomUUID(),
    description: '',
    quantity: 1,
    unit: 'Stk',
    unitPrice: 0,
    discountPct: 0,
  }
}
