import type { BusinessDocument, CompanySettings, LineItem } from './types'
import { amountPaid } from './documentTotals'
import { round2, roundRappen, todayIso } from './format'

export const DUNNING_LABEL = ['1. Mahnung', '2. Mahnung', 'Letzte Mahnung'] as const

export function isOverdue(d: BusinessDocument, today = todayIso()): boolean {
  return (
    d.type === 'rechnung' &&
    ['versendet', 'teilbezahlt', 'ueberfaellig'].includes(d.status) &&
    !!d.dueDate &&
    d.dueDate < today
  )
}

export function daysOverdue(d: BusinessDocument, today = todayIso()): number {
  if (!d.dueDate) return 0
  return Math.max(0, Math.round((Date.parse(today) - Date.parse(d.dueDate)) / 86400_000))
}

/** Whether the next dunning level may be sent yet (interval since last reminder). */
export function dunningDue(d: BusinessDocument, settings: CompanySettings, today = todayIso()): boolean {
  if (!isOverdue(d, today) || d.dunningLevel >= 3) return false
  if (!d.lastDunnedAt) return true
  const interval = settings.dunning?.intervalDays ?? 14
  return Date.parse(today) - Date.parse(d.lastDunnedAt.slice(0, 10)) >= interval * 86400_000
}

export function dunningFeeFor(level: 1 | 2 | 3, settings: CompanySettings): number {
  return settings.dunning?.fees[level - 1] ?? 0
}

/** Total fee accumulated up to and including `level`. */
export function cumulativeFee(level: 1 | 2 | 3, settings: CompanySettings): number {
  const fees = settings.dunning?.fees ?? [0, 20, 40]
  return round2(fees.slice(0, level).reduce((s, f) => s + f, 0))
}

/**
 * Build a read-only document for the Mahnung PDF: original line items + a
 * "Mahngebühr" line, dunning texts, and a QR bill for the open amount + fees.
 */
export function dunningDocument(
  invoice: BusinessDocument,
  level: 1 | 2 | 3,
  settings: CompanySettings,
): BusinessDocument {
  const open = round2(invoice.total - amountPaid(invoice))
  const fee = cumulativeFee(level, settings)
  const feeLine: LineItem = {
    id: 'mahngebuehr',
    description: `Mahngebühr (${DUNNING_LABEL[level - 1]})`,
    quantity: 1,
    unit: 'Pausch.',
    unitPrice: fee,
    discountPct: 0,
  }
  const openLine: LineItem = {
    id: 'offener-betrag',
    description: `Offener Betrag aus Rechnung ${invoice.number} vom ${invoice.date}`,
    quantity: 1,
    unit: 'Pausch.',
    unitPrice: open,
    discountPct: 0,
  }
  const lineItems = fee > 0 ? [openLine, feeLine] : [openLine]
  const total = roundRappen(open + fee)

  return {
    ...invoice,
    id: `${invoice.id}-mahnung${level}`,
    lineItems,
    globalDiscountPct: 0,
    subtotal: round2(open + fee),
    discountTotal: 0,
    total,
    roundingDelta: round2(total - (open + fee)),
    status: 'ueberfaellig',
    payments: [],
    dunningLevel: level,
    introText: settings.dunning?.texts[level - 1] ?? '',
    outroText: `Zahlbar innert ${level === 3 ? 5 : 10} Tagen. Bei Fragen kontaktieren Sie uns.`,
    dueDate: undefined,
  }
}
