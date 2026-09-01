import { pdf } from '@react-pdf/renderer'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'
import { uploadFile } from '@/lib/storage'
import { DOCUMENT_TYPE_LABEL } from '@/hooks/useDocuments'
import { DocumentPdf } from './DocumentPdf'
import type { BusinessDocument, CompanySettings } from '@/lib/types'

function fileName(d: BusinessDocument): string {
  return `${DOCUMENT_TYPE_LABEL[d.type]}_${d.number}.pdf`.replace(/\s+/g, '_')
}

export async function buildPdfBlob(
  d: BusinessDocument,
  settings: CompanySettings,
): Promise<Blob> {
  return pdf(<DocumentPdf document={d} settings={settings} />).toBlob()
}

export async function downloadDocumentPdf(d: BusinessDocument, settings: CompanySettings) {
  const blob = await buildPdfBlob(d, settings)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName(d)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Render, store the exact same PDF in Storage, return its path. */
export async function storeDocumentPdf(
  d: BusinessDocument,
  settings: CompanySettings,
): Promise<string> {
  const blob = await buildPdfBlob(d, settings)
  const path = `documents/${d.id}/${fileName(d)}`
  await uploadFile(path, blob)
  return path
}

interface SendResult {
  ok: boolean
}

export async function emailDocument(params: {
  document: BusinessDocument
  settings: CompanySettings
  to: string
  subject: string
  body: string
}): Promise<void> {
  const pdfStoragePath = await storeDocumentPdf(params.document, params.settings)
  const call = httpsCallable<Record<string, unknown>, SendResult>(functions, 'sendDocumentEmail')
  await call({
    documentId: params.document.id,
    to: params.to,
    subject: params.subject,
    body: params.body,
    pdfStoragePath,
  })
}
