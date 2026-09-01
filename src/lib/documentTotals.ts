import type { BusinessDocument, DocumentDiscount, DocumentType, LineItem } from './types'
import { round2, roundRappen } from './format'

export function lineNet(item: LineItem): number {
  const gross = item.quantity * item.unitPrice
  return round2(gross * (1 - (item.discountPct || 0) / 100))
}

export interface DiscountResultLine {
  label: string
  amount: number
  isShipping?: boolean
}

export interface DocumentTotals {
  /** Sum of line nets (after per-line discounts), before document discounts & shipping. */
  subtotal: number
  discountLines: DiscountResultLine[]
  /** Sum of all goods discounts (does not include free-shipping). */
  discountTotal: number
  shipping: number
  freeShipping: boolean
  total: number
  roundingDelta: number
}

export interface TotalsInput {
  lineItems: LineItem[]
  type: DocumentType
  globalDiscountPct?: number
  discounts?: DocumentDiscount[]
  shipping?: number
}

function labelFor(d: DocumentDiscount): string {
  if (d.label.trim()) return d.label.trim()
  if (d.kind === 'percent') return `Rabatt ${d.value}%`
  if (d.kind === 'amount') return 'Rabatt'
  return 'Gratis Versand'
}

/** Invoices get 5-Rappen rounding; offers/other documents are shown exact. */
export function computeTotals(input: TotalsInput): DocumentTotals {
  const { lineItems, type } = input
  const shipping = round2(input.shipping ?? 0)
  const subtotal = round2(lineItems.reduce((sum, it) => sum + lineNet(it), 0))

  const discountLines: DiscountResultLine[] = []
  let freeShipping = false

  if (input.globalDiscountPct && input.globalDiscountPct > 0) {
    discountLines.push({
      label: `Rabatt ${input.globalDiscountPct}%`,
      amount: round2((subtotal * input.globalDiscountPct) / 100),
    })
  }

  for (const d of input.discounts ?? []) {
    if (d.kind === 'freeShipping') {
      freeShipping = true
      if (shipping > 0) {
        discountLines.push({ label: labelFor(d), amount: shipping, isShipping: true })
      }
      continue
    }
    const base =
      d.scope === 'lines' && d.lineItemIds?.length
        ? round2(
            lineItems
              .filter((it) => d.lineItemIds!.includes(it.id))
              .reduce((s, it) => s + lineNet(it), 0),
          )
        : subtotal
    const raw = d.kind === 'percent' ? (base * d.value) / 100 : d.value
    discountLines.push({ label: labelFor(d), amount: round2(Math.min(Math.max(raw, 0), base)) })
  }

  const goodsDiscount = round2(
    discountLines.filter((l) => !l.isShipping).reduce((s, l) => s + l.amount, 0),
  )
  const discountTotal = Math.min(goodsDiscount, subtotal)
  const effShipping = freeShipping ? 0 : shipping
  const net = round2(subtotal - discountTotal + effShipping)
  const total = type === 'rechnung' ? roundRappen(net) : net
  const roundingDelta = round2(total - net)

  return { subtotal, discountLines, discountTotal, shipping, freeShipping, total, roundingDelta }
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

export function newDiscount(): DocumentDiscount {
  return {
    id: crypto.randomUUID(),
    label: '',
    kind: 'percent',
    value: 10,
    scope: 'total',
  }
}
