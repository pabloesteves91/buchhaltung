const chf = new Intl.NumberFormat('de-CH', {
  style: 'currency',
  currency: 'CHF',
  minimumFractionDigits: 2,
})

const chfPlain = new Intl.NumberFormat('de-CH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCHF(amount: number): string {
  return chf.format(amount ?? 0)
}

export function formatAmount(amount: number): string {
  return chfPlain.format(amount ?? 0)
}

/** Swiss 5-Rappen rounding (Rappenrundung). */
export function roundRappen(amount: number): number {
  return Math.round(amount * 20) / 20
}

/** Round to 2 decimals, avoiding float drift. */
export function round2(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return '–'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export function todayIso(): string {
  const now = new Date()
  const tz = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - tz).toISOString().slice(0, 10)
}

export function fiscalYearOf(iso: string): number {
  return Number(iso.slice(0, 4))
}
