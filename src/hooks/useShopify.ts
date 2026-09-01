import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useEffect, useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { Collections, listDocs, orderBy } from '@/lib/db'

export type ShopifyBookingStatus =
  | 'open'
  | 'booked'
  | 'cancelled'
  | 'refunded'
  | 'refund_pending'

export interface ShopifyOrderDoc {
  id: string
  orderId: string
  orderName: string
  orderNumber: number
  orderedAt: string
  date: string
  currency: string
  financialStatus: string
  cancelled: boolean
  total: number
  tax: number
  shipping: number
  goods: number
  customerName: string
  customerEmail: string | null
  contactId: string | null
  bookingStatus: ShopifyBookingStatus
  bookedTransactionIds?: string[]
  pendingRefund?: number
  lineItems: { title: string; quantity: number; price: number }[]
}

export interface ShopifyConfig {
  shopDomain?: string
  adminApiToken?: string
  apiSecretKey?: string
  apiVersion?: string
  autoBook?: boolean
  createContacts?: boolean
  accounts?: {
    revenueId?: string
    shippingId?: string
    feeId?: string
    moneyId?: string
    refundId?: string
  }
  connected?: boolean
  shopName?: string
  lastImportAt?: string
  webhookIds?: number[]
  webhooksAddress?: string
}

const configRef = () => doc(db, 'settings', 'shopify')

export function useShopifyConfig() {
  const [config, setConfig] = useState<ShopifyConfig | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    return onSnapshot(configRef(), (snap) => {
      setConfig(snap.exists() ? (snap.data() as ShopifyConfig) : {})
      setLoading(false)
    })
  }, [])
  return { config, loading }
}

export function useSaveShopifyConfig() {
  return useMutation({
    mutationFn: async (patch: Partial<ShopifyConfig>) => {
      await setDoc(configRef(), { ...patch, updatedAt: serverTimestamp() }, { merge: true })
    },
  })
}

export function useShopifyOrders() {
  return useQuery({
    queryKey: ['shopifyOrders'],
    queryFn: () =>
      listDocs<ShopifyOrderDoc>(Collections.shopifyOrders, orderBy('orderedAt', 'desc')),
    refetchInterval: 20_000,
  })
}

function callable<TIn, TOut>(name: string) {
  const fn = httpsCallable<TIn, TOut>(functions, name)
  return async (data: TIn) => (await fn(data)).data
}

export function useShopifyActions() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['shopifyOrders'] })
    qc.invalidateQueries({ queryKey: ['transactions'] })
    qc.invalidateQueries({ queryKey: ['contacts'] })
  }

  return {
    test: useMutation({
      mutationFn: callable<Record<string, never>, { name: string; domain: string; currency: string }>(
        'testShopifyConnection',
      ),
      onSuccess: async (res) => {
        await setDoc(
          configRef(),
          { connected: true, shopName: res.name },
          { merge: true },
        )
      },
    }),
    importOrders: useMutation({
      mutationFn: callable<{ sinceDays: number }, { imported: number }>('importShopifyOrders'),
      onSuccess: invalidate,
    }),
    book: useMutation({
      mutationFn: callable<{ orderId: string | string[] }, { booked: number }>('bookShopifyOrder'),
      onSuccess: invalidate,
    }),
    unbook: useMutation({
      mutationFn: callable<{ orderId: string }, { ok: boolean }>('unbookShopifyOrder'),
      onSuccess: invalidate,
    }),
    registerWebhooks: useMutation({
      mutationFn: callable<Record<string, never>, { registered: number; address: string }>(
        'registerShopifyWebhooks',
      ),
    }),
  }
}

export async function unbookedOrderCount(): Promise<number> {
  const orders = await listDocs<ShopifyOrderDoc>(Collections.shopifyOrders)
  return orders.filter((o) => o.bookingStatus === 'open' || o.bookingStatus === 'refund_pending')
    .length
}

export async function getShopifyConfigOnce(): Promise<ShopifyConfig> {
  const snap = await getDoc(configRef())
  return snap.exists() ? (snap.data() as ShopifyConfig) : {}
}
