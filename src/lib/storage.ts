import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage'
import { storage } from './firebase'

/** Upload a file to a fixed path (overwrites) and return its download URL. */
export async function uploadFile(path: string, file: File | Blob): Promise<string> {
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, {
    contentType: file instanceof File ? file.type : 'application/octet-stream',
  })
  return getDownloadURL(storageRef)
}

export async function fileUrl(path: string): Promise<string> {
  return getDownloadURL(ref(storage, path))
}

export async function deleteFile(path: string): Promise<void> {
  await deleteObject(ref(storage, path)).catch(() => {})
}

export interface UploadedAttachment {
  storagePath: string
  name: string
  contentType: string
  size: number
  uploadedAt: string
}

/** Upload one attachment (receipt) under a folder and return its metadata. */
export async function uploadAttachment(
  folder: string,
  file: File,
): Promise<UploadedAttachment> {
  const safeName = file.name.replace(/[^\w.\- ]+/g, '_')
  const path = `${folder}/${Date.now()}-${safeName}`
  await uploadFile(path, file)
  return {
    storagePath: path,
    name: file.name,
    contentType: file.type || 'application/octet-stream',
    size: file.size,
    uploadedAt: new Date().toISOString(),
  }
}
