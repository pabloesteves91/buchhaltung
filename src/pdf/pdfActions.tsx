import { pdf } from '@react-pdf/renderer'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'
import { uploadFile } from '@/lib/storage'
import { DOCUMENT_TYPE_LABEL } from '@/hooks/useDocuments'
import { DocumentPdf } from './DocumentPdf'
import { buildQrBillPng } from './qrBill'
import type { BusinessDocument, CompanySettings } from '@/lib/types'

function fileName(d: BusinessDocument, opts: PdfOptions = {}): string {
  const label = opts.fileLabel ?? (opts.receipt ? 'Beleg' : DOCUMENT_TYPE_LABEL[d.type])
  return `${label}_${d.number}.pdf`.replace(/\s+/g, '_')
}

export interface PdfOptions {
  /** Force the QR payment part on/off. Default: on for unpaid invoices. */
  withQr?: boolean
  /** Render as a paid receipt (no QR, "Beleg" heading). */
  receipt?: boolean
  /** Override the document heading (e.g. "1. Mahnung"). */
  heading?: string
  /** File name label (defaults to the doc type). */
  fileLabel?: string
}

export async function buildPdfBlob(
  d: BusinessDocument,
  settings: CompanySettings,
  opts: PdfOptions = {},
): Promise<Blob> {
  const wantQr = opts.withQr ?? (d.type === 'rechnung' && !opts.receipt && d.status !== 'bezahlt')
  const qrBillPng = wantQr ? await buildQrBillPng(d, settings) : null
  return pdf(
    <DocumentPdf
      document={d}
      settings={settings}
      qrBillPng={qrBillPng}
      receipt={opts.receipt}
      headingOverride={opts.heading}
    />,
  ).toBlob()
}

export async function downloadDocumentPdf(
  d: BusinessDocument,
  settings: CompanySettings,
  opts: PdfOptions = {},
) {
  const blob = await buildPdfBlob(d, settings, opts)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName(d, opts)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Render, store the exact same PDF in Storage, return its path. */
export async function storeDocumentPdf(
  d: BusinessDocument,
  settings: CompanySettings,
  opts: PdfOptions = {},
): Promise<string> {
  const blob = await buildPdfBlob(d, settings, opts)
  const path = `documents/${d.id}/${fileName(d, opts)}`
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
  pdfOptions?: PdfOptions
}): Promise<void> {
  const pdfStoragePath = await storeDocumentPdf(
    params.document,
    params.settings,
    params.pdfOptions,
  )
  const call = httpsCallable<Record<string, unknown>, SendResult>(functions, 'sendDocumentEmail')
  await call({
    documentId: params.document.id,
    to: params.to,
    subject: params.subject,
    body: params.body,
    pdfStoragePath,
  })
}
