import { parseCsvObjects } from './csv'
import { Collections, createDoc, listDocs } from './db'
import type { Contact } from './types'
import type { ShopifyOrderDoc } from '@/hooks/useShopify'

function n(v: string | undefined): number {
  const x = Number((v ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0
}

function isoDate(v: string | undefined): string {
  const m = (v ?? '').match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : new Date().toISOString().slice(0, 10)
}

export interface CsvImportResult {
  imported: number
  skipped: number
  contactsCreated: number
}

/**
 * Import a Shopify "Orders export" CSV (Bestellungen → Exportieren), fully
 * client-side. One order spans several rows (one per line item); only the first
 * row of an order carries the header fields like Total / Email.
 */
export async function importShopifyOrdersCsv(
  text: string,
  opts: { createContacts: boolean },
): Promise<CsvImportResult> {
  const rows = parseCsvObjects(text)
  if (rows.length === 0) throw new Error('CSV enthält keine Zeilen.')
  if (!('Name' in rows[0]) || !('Total' in rows[0])) {
    throw new Error(
      'Das sieht nicht nach einem Shopify-Bestellexport aus (Spalten „Name“/„Total“ fehlen).',
    )
  }

  const groups = new Map<string, Record<string, string>[]>()
  for (const r of rows) {
    const key = r['Name'] || r['Id'] || ''
    if (!key) continue
    const g = groups.get(key) ?? []
    g.push(r)
    groups.set(key, g)
  }

  const existing = await listDocs<ShopifyOrderDoc>(Collections.shopifyOrders)
  const existingNames = new Set(existing.map((o) => o.orderName))
  const contacts = await listDocs<Contact>(Collections.contacts)

  let imported = 0
  let skipped = 0
  let contactsCreated = 0

  for (const [name, gRows] of groups) {
    if (existingNames.has(name)) {
      skipped++
      continue
    }
    const head = gRows[0]
    const total = n(head['Total'])
    const shipping = n(head['Shipping'])
    const email = (head['Email'] || '').toLowerCase() || null
    const customerName = head['Billing Name'] || head['Shipping Name'] || email || 'Gast'

    let contactId: string | null = null
    if (opts.createContacts) {
      const existingContact = email
        ? contacts.find((c) => c.email && c.email.toLowerCase() === email)
        : undefined
      if (existingContact) {
        contactId = existingContact.id
      } else if (email || customerName !== 'Gast') {
        contactId = await createDoc(Collections.contacts, {
          type: 'kunde',
          sortName: customerName.toLowerCase(),
          company: head['Billing Company'] || undefined,
          firstName: '',
          lastName: head['Billing Name'] || customerName,
          email: email ?? '',
          address: {
            line1: head['Billing Street'] || head['Billing Address1'] || '',
            zip: head['Billing Zip'] || '',
            city: head['Billing City'] || '',
            country: (head['Billing Country'] || 'CH').slice(0, 2).toUpperCase(),
          },
          language: 'de',
          paymentTermDays: 30,
          tags: ['Shopify'],
        })
        contactsCreated++
      }
    }

    const lineItems = gRows
      .filter((r) => r['Lineitem name'])
      .map((r) => ({
        title: r['Lineitem name'],
        quantity: Number(r['Lineitem quantity'] || '1'),
        price: n(r['Lineitem price']),
      }))

    await createDoc(Collections.shopifyOrders, {
      orderId: head['Id'] || name.replace(/\D/g, '') || name,
      orderName: name,
      orderNumber: Number(name.replace(/\D/g, '')) || 0,
      orderedAt: head['Created at'] || new Date().toISOString(),
      date: isoDate(head['Created at']),
      currency: head['Currency'] || 'CHF',
      financialStatus: head['Financial Status'] || 'unknown',
      cancelled: false,
      total,
      tax: n(head['Taxes']),
      shipping,
      goods: Math.round((total - shipping) * 100) / 100,
      customerName,
      customerEmail: email,
      contactId,
      bookingStatus: 'open',
      source: 'csv',
      lineItems,
    })
    imported++
  }

  return { imported, skipped, contactsCreated }
}
