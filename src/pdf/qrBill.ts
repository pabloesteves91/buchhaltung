import { SwissQRBill } from 'swissqrbill/svg'
import { calculateQRReferenceChecksum, isIBANValid, isQRIBAN } from 'swissqrbill/utils'
import type { Data } from 'swissqrbill/types'
import type { BusinessDocument, CompanySettings } from '@/lib/types'

/** Build a QRR reference (26 digits + mod-10 checksum) from the invoice number. */
function qrReferenceFor(docNumber: string): string {
  const digits = (docNumber.match(/\d/g) ?? []).join('') || '0'
  const base = digits.slice(-26).padStart(26, '0')
  return base + calculateQRReferenceChecksum(base)
}

export function qrBillData(
  d: BusinessDocument,
  settings: CompanySettings,
): Data | null {
  const rawAccount = (settings.bank.qrIban || settings.bank.iban || '').replace(/\s/g, '')
  if (!rawAccount || !isIBANValid(rawAccount)) return null

  const usesQrIban = isQRIBAN(rawAccount)
  const s = settings.address

  const data: Data = {
    currency: 'CHF',
    amount: d.total > 0 ? d.total : undefined,
    creditor: {
      account: rawAccount,
      name: settings.name,
      address: s.line1 || settings.name,
      zip: s.zip,
      city: s.city,
      country: s.country || 'CH',
    },
  }

  if (usesQrIban) {
    data.reference = qrReferenceFor(d.number)
    data.message = `${d.type === 'gutschrift' ? 'Gutschrift' : 'Rechnung'} ${d.number}`
  } else {
    data.message = `${d.type === 'gutschrift' ? 'Gutschrift' : 'Rechnung'} ${d.number}`
  }

  const r = d.recipientSnapshot
  if (r.name && r.zip && r.city) {
    data.debtor = {
      name: r.name,
      address: r.street || r.name,
      zip: r.zip,
      city: r.city,
      country: r.country || 'CH',
    }
  }

  return data
}

/**
 * Render the Swiss QR-bill payment part to a high-resolution PNG data URL so it
 * can be embedded in the @react-pdf document (deterministic, no fonts to load).
 * Returns null when no valid IBAN/QR-IBAN is configured.
 */
export async function buildQrBillPng(
  d: BusinessDocument,
  settings: CompanySettings,
): Promise<string | null> {
  const data = qrBillData(d, settings)
  if (!data) return null

  let svg: string
  try {
    svg = new SwissQRBill(data, { language: pickLanguage(d) }).toString()
  } catch {
    return null
  }

  // The payment part is 210 × 105 mm. Rasterise at ~8× for crisp print output.
  const scale = 8
  const wmm = 210
  const hmm = 105
  const w = Math.round((wmm / 25.4) * 96 * (scale / 3))
  const h = Math.round((hmm / 25.4) * 96 * (scale / 3))

  const sized = svg
    .replace(/width="[^"]*"/, `width="${w}"`)
    .replace(/height="[^"]*"/, `height="${h}"`)

  const blob = new Blob([sized], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

function pickLanguage(d: BusinessDocument): 'DE' | 'FR' | 'IT' | 'EN' {
  switch (d.recipientSnapshot.language) {
    case 'fr':
      return 'FR'
    case 'it':
      return 'IT'
    case 'en':
      return 'EN'
    default:
      return 'DE'
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('QR-SVG konnte nicht gerendert werden'))
    img.src = src
  })
}
