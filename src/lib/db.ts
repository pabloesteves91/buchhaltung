import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from './firebase'

/** Known top-level collections. */
export const Collections = {
  accounts: 'accounts',
  transactions: 'transactions',
  contacts: 'contacts',
  documents: 'documents',
  notes: 'notes',
  fiscalYears: 'fiscalYears',
  shopifyOrders: 'shopifyOrders',
  shopifyPayouts: 'shopifyPayouts',
  numberSequences: 'numberSequences',
  auditLog: 'auditLog',
} as const

export type CollectionName = (typeof Collections)[keyof typeof Collections]

export async function listDocs<T>(
  name: CollectionName,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const snap = await getDocs(query(collection(db, name), ...constraints))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)
}

export async function getOne<T>(name: CollectionName, id: string): Promise<T | null> {
  const snap = await getDoc(doc(db, name, id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() }) as T : null
}

export async function createDoc<T extends object>(
  name: CollectionName,
  data: T,
): Promise<string> {
  const ref = await addDoc(collection(db, name), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function upsertDoc<T extends object>(
  name: CollectionName,
  id: string,
  data: T,
): Promise<void> {
  await setDoc(
    doc(db, name, id),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

export async function patchDoc(
  name: CollectionName,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  await updateDoc(doc(db, name, id), { ...data, updatedAt: serverTimestamp() })
}

export async function removeDoc(name: CollectionName, id: string): Promise<void> {
  await deleteDoc(doc(db, name, id))
}

export { orderBy, where, query, collection }

/** Settings live in a fixed document so rules & code stay simple. */
export const settingsRef = () => doc(db, 'settings', 'company')
