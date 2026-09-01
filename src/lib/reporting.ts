import type { Account, BusinessDocument, Transaction } from './types'
import type { ShopifyOrderDoc } from '@/hooks/useShopify'
import { round2 } from './format'

export interface MonthBucket {
  month: number
  income: number
  expense: number
}

export function monthlyBuckets(transactions: Transaction[]): MonthBucket[] {
  const buckets: MonthBucket[] = Array.from({ length: 12 }, (_, i) => ({
    month: i,
    income: 0,
    expense: 0,
  }))
  for (const t of transactions) {
    const m = Number(t.date.slice(5, 7)) - 1
    if (m < 0 || m > 11) continue
    if (t.kind === 'einnahme') buckets[m].income += t.amount
    else if (t.kind === 'ausgabe') buckets[m].expense += t.amount
  }
  return buckets.map((b) => ({ ...b, income: round2(b.income), expense: round2(b.expense) }))
}

export interface CategoryLine {
  accountId: string
  number: string
  name: string
  kind: 'ertrag' | 'aufwand'
  amount: number
}

export function byCategory(transactions: Transaction[], accounts: Account[]): CategoryLine[] {
  const map = new Map<string, number>()
  for (const t of transactions) {
    if (t.kind === 'umbuchung') continue
    map.set(t.categoryAccountId, (map.get(t.categoryAccountId) ?? 0) + t.amount)
  }
  const lines: CategoryLine[] = []
  for (const [accountId, amount] of map) {
    const a = accounts.find((x) => x.id === accountId)
    if (!a) continue
    lines.push({
      accountId,
      number: a.number,
      name: a.name,
      kind: a.type === 'ertrag' ? 'ertrag' : 'aufwand',
      amount: round2(amount),
    })
  }
  return lines.sort((a, b) => b.amount - a.amount)
}

/** Current balance per money account (Aktiven / short-term Passiven). */
export function accountBalances(
  transactions: Transaction[],
  accounts: Account[],
): { account: Account; balance: number }[] {
  return accounts
    .filter((a) => a.type === 'aktiven')
    .map((a) => {
      let balance = a.openingBalance ?? 0
      for (const t of transactions) {
        if (t.paymentAccountId === a.id) {
          balance += t.kind === 'einnahme' ? t.amount : t.kind === 'ausgabe' ? -t.amount : 0
        }
        if (t.kind === 'umbuchung' && t.categoryAccountId === a.id) balance += t.amount
        if (t.kind === 'umbuchung' && t.paymentAccountId === a.id) balance -= t.amount
      }
      return { account: a, balance: round2(balance) }
    })
    .filter((b) => Math.abs(b.balance) > 0.005 || b.account.isSystem)
}

export interface CustomerRevenue {
  name: string
  contactId?: string
  amount: number
  orders: number
}

export function topCustomers(
  orders: ShopifyOrderDoc[],
  documents: BusinessDocument[],
): CustomerRevenue[] {
  const map = new Map<string, CustomerRevenue>()
  const add = (key: string, name: string, amount: number, contactId?: string) => {
    const cur = map.get(key) ?? { name, contactId, amount: 0, orders: 0 }
    cur.amount = round2(cur.amount + amount)
    cur.orders += 1
    if (contactId) cur.contactId = contactId
    map.set(key, cur)
  }
  for (const o of orders) {
    if (o.bookingStatus === 'cancelled') continue
    add(o.contactId || o.customerEmail || o.customerName, o.customerName, o.total, o.contactId ?? undefined)
  }
  for (const d of documents) {
    if (d.type !== 'rechnung' || d.status === 'storniert') continue
    add(d.contactId || d.recipientSnapshot.name, d.recipientSnapshot.name, d.total, d.contactId)
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount)
}

export interface ProductLine {
  title: string
  quantity: number
  revenue: number
}

export function topProducts(orders: ShopifyOrderDoc[]): ProductLine[] {
  const map = new Map<string, ProductLine>()
  for (const o of orders) {
    if (o.bookingStatus === 'cancelled') continue
    for (const li of o.lineItems) {
      const cur = map.get(li.title) ?? { title: li.title, quantity: 0, revenue: 0 }
      cur.quantity += li.quantity
      cur.revenue = round2(cur.revenue + li.price * li.quantity)
      map.set(li.title, cur)
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue)
}

export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell)
          return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(';'),
    )
    .join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
