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
