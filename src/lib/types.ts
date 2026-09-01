import type { Timestamp } from 'firebase/firestore'

/** ISO date string, always `YYYY-MM-DD` (no time, no timezone games). */
export type IsoDate = string

export type AccountType = 'aktiven' | 'passiven' | 'aufwand' | 'ertrag'

export interface Account {
  id: string
  /** Account number from the Kontenrahmen KMU, e.g. "1020". */
  number: string
  name: string
  type: AccountType
  /** Coarse group label for the tree view, e.g. "Umlaufvermögen". */
  group: string
  /** System accounts cannot be deleted (only deactivated). */
  isSystem: boolean
  active: boolean
  /** Opening balance in CHF (Rappen precision), positive = normal side of the account. */
  openingBalance: number
  sortKey: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export type TransactionKind = 'einnahme' | 'ausgabe' | 'umbuchung'
export type TransactionSource = 'manual' | 'shopify' | 'import'

export interface Attachment {
  storagePath: string
  name: string
  contentType: string
  size: number
  uploadedAt: string
}

export interface Transaction {
  id: string
  date: IsoDate
  fiscalYear: number
  description: string
  /** Always positive, in CHF (Rappen precision as integer * 100 is NOT used — we store decimals). */
  amount: number
  kind: TransactionKind
  /** Income/expense category account (Ertrag/Aufwand), or the target account for umbuchung. */
  categoryAccountId: string
  /** Bank / cash / receivable account the money actually moved through. */
  paymentAccountId: string
  attachments: Attachment[]
  tags: string[]
  note?: string
  source: TransactionSource
  linkedDocumentId?: string
  shopifyOrderId?: string
  reconciled: boolean
  /** Set when this booking reverses another (Storno). */
  reversesTransactionId?: string
  locked: boolean
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export type ContactType = 'kunde' | 'lieferant' | 'beides'
export type ContactLanguage = 'de' | 'fr' | 'it' | 'en'

export interface Contact {
  id: string
  type: ContactType
  /** Lowercased display name, used for stable sorting. */
  sortName: string
  company?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address: {
    line1?: string
    line2?: string
    zip?: string
    city?: string
    country: string
  }
  language: ContactLanguage
  /** Default payment term in days. */
  paymentTermDays: number
  vatNumber?: string
  tags: string[]
  note?: string
  shopifyCustomerId?: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export type DocumentType =
  | 'offerte'
  | 'auftragsbestaetigung'
  | 'rechnung'
  | 'gutschrift'
  | 'lieferschein'

export type DocumentStatus =
  | 'entwurf'
  | 'versendet'
  | 'teilbezahlt'
  | 'bezahlt'
  | 'ueberfaellig'
  | 'storniert'

export interface LineItem {
  id: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  /** Discount on this line in percent (0–100). */
  discountPct: number
}

export type DocumentDiscountKind = 'percent' | 'amount' | 'freeShipping'

export interface DocumentDiscount {
  id: string
  label: string
  kind: DocumentDiscountKind
  /** percent (0–100) for 'percent', CHF for 'amount', ignored for 'freeShipping'. */
  value: number
  /** 'total' → whole document; 'lines' → only the referenced positions. */
  scope: 'total' | 'lines'
  lineItemIds?: string[]
}

export interface Payment {
  id: string
  date: IsoDate
  amount: number
  method: string
  note?: string
  transactionId?: string
}

export interface BusinessDocument {
  id: string
  type: DocumentType
  number: string
  contactId: string
  /** Denormalized snapshot of the recipient at creation time (so old PDFs never change). */
  recipientSnapshot: {
    name: string
    /** Formatted lines for display on the PDF. */
    address: string[]
    /** Structured address for the QR-bill debtor block. */
    street?: string
    zip?: string
    city?: string
    country?: string
    email?: string
    language: ContactLanguage
  }
  date: IsoDate
  dueDate?: IsoDate
  fiscalYear: number
  currency: 'CHF'
  lineItems: LineItem[]
  /** @deprecated use `discounts`. Global discount in percent. Still honoured. */
  globalDiscountPct: number
  /** Rabatte: %, fester Betrag, gratis Versand – auf die ganze Rechnung oder auf Positionen. */
  discounts?: DocumentDiscount[]
  /** Versandkosten in CHF (0 = kein Versand ausgewiesen). */
  shipping?: number
  subtotal: number
  discountTotal: number
  /** Rounded to 0.05 for invoices. */
  total: number
  roundingDelta: number
  status: DocumentStatus
  payments: Payment[]
  introText?: string
  outroText?: string
  note?: string
  templateId: string
  /** Document this was created from (Offerte -> Rechnung). */
  linkedFromId?: string
  qrBill?: {
    referenceType: 'QRR' | 'SCOR' | 'NON'
    reference?: string
    message?: string
  }
  pdfStoragePath?: string
  sentAt?: string
  sentTo?: string
  dunningLevel: 0 | 1 | 2 | 3
  lastDunnedAt?: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export type FiscalYearStatus = 'offen' | 'abgeschlossen'

export interface FiscalYear {
  id: string
  year: number
  start: IsoDate
  end: IsoDate
  status: FiscalYearStatus
  lockedThrough?: IsoDate
  closingResult?: number
  closedAt?: string
}

export interface Product {
  id: string
  source: 'shopify' | 'manual'
  title: string
  sku?: string
  price: number
  unit: string
  active: boolean
  shopifyProductId?: string
  shopifyVariantId?: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface Note {
  id: string
  title: string
  body: string
  pinned: boolean
  linkedTo?: { kind: 'contact' | 'transaction' | 'document'; id: string }
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface CompanySettings {
  name: string
  legalForm: string
  /** Contact person shown on documents ("Ihr Kontakt"). */
  contactPerson?: string
  address: {
    line1: string
    line2?: string
    zip: string
    city: string
    country: string
  }
  email: string
  phone?: string
  website?: string
  /** Not VAT-registered for now, but keep the switch. */
  taxMode: 'none' | 'effective' | 'saldo'
  vatNumber?: string
  currency: 'CHF'
  fiscalYearStartMonth: number
  logoStoragePath?: string
  logoUrl?: string
  /** Downscaled PNG data URL, embedded directly into PDFs (no fetch, no CORS,
   *  byte-stable output). */
  logoDataUrl?: string
  bank: {
    name?: string
    iban?: string
    qrIban?: string
  }
  invoice: {
    defaultPaymentTermDays: number
    numberPrefix: Record<DocumentType, string>
    footerText: string
    defaultIntroText: string
    defaultOutroText: string
    accentColor: string
  }
  dunning?: {
    /** Fee added at each level (index 0 = 1. Mahnung). CHF. */
    fees: [number, number, number]
    /** Days after the previous step before the next reminder is due. */
    intervalDays: number
    /** Reminder body text per level. */
    texts: [string, string, string]
  }
  createdAt?: Timestamp
  updatedAt?: Timestamp
}
