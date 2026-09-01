import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, Field, Input, Select } from '@/components/ui'
import { DEFAULT_SETTINGS, useSaveSettings, useSettings } from '@/hooks/useSettings'
import { uploadFile } from '@/lib/storage'
import { toScaledPngDataUrl } from '@/lib/image'
import { exportAllData, downloadBlob } from '@/lib/backup'
import { todayIso } from '@/lib/format'
import type { CompanySettings } from '@/lib/types'

export function SettingsPage() {
  const { data } = useSettings()
  const save = useSaveSettings()
  const [form, setForm] = useState<CompanySettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  function set<K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const path = `branding/logo-${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_')}`
      const [url, dataUrl] = await Promise.all([
        uploadFile(path, file),
        toScaledPngDataUrl(file).catch(() => undefined),
      ])
      const next = { ...form, logoStoragePath: path, logoUrl: url, logoDataUrl: dataUrl }
      setForm(next)
      await save.mutateAsync(next)
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const [exporting, setExporting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await save.mutateAsync(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleExport() {
    setExporting(true)
    try {
      downloadBlob(`buchhaltung-backup-${todayIso()}.json`, await exportAllData())
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader title="Einstellungen" subtitle="Firmendaten, Bankverbindung und Rechnungsvorgaben." />
      <form onSubmit={submit} className="space-y-6">
        <Card title="Logo" >
          <div className="flex items-center gap-6">
            <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-slate-400">Kein Logo</span>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handleLogo}
                className="hidden"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Wird hochgeladen …' : form.logoUrl ? 'Logo ersetzen' : 'Logo hochladen'}
              </Button>
              {form.logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    const next = {
                      ...form,
                      logoStoragePath: undefined,
                      logoUrl: undefined,
                      logoDataUrl: undefined,
                    }
                    setForm(next)
                    void save.mutateAsync(next)
                  }}
                >
                  Entfernen
                </Button>
              )}
              <p className="text-xs text-slate-400">
                PNG, JPG oder SVG. Erscheint im Menü und auf Offerten & Rechnungen.
              </p>
            </div>
          </div>
        </Card>

        <Card title="Firma">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Rechtsform">
              <Input value={form.legalForm} onChange={(e) => set('legalForm', e.target.value)} />
            </Field>
            <Field label="Kontaktperson" hint="Erscheint auf Offerten & Rechnungen als „Ihr Kontakt“.">
              <Input
                value={form.contactPerson ?? ''}
                onChange={(e) => set('contactPerson', e.target.value)}
                placeholder="Vor- und Nachname"
              />
            </Field>
            <Field label="Strasse / Nr.">
              <Input
                value={form.address.line1}
                onChange={(e) => set('address', { ...form.address, line1: e.target.value })}
              />
            </Field>
            <Field label="Adresszusatz">
              <Input
                value={form.address.line2 ?? ''}
                onChange={(e) => set('address', { ...form.address, line2: e.target.value })}
              />
            </Field>
            <Field label="PLZ">
              <Input
                value={form.address.zip}
                onChange={(e) => set('address', { ...form.address, zip: e.target.value })}
              />
            </Field>
            <Field label="Ort">
              <Input
                value={form.address.city}
                onChange={(e) => set('address', { ...form.address, city: e.target.value })}
              />
            </Field>
            <Field label="E-Mail">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <Field label="Telefon">
              <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="MWST & Geschäftsjahr">
          <div className="grid grid-cols-2 gap-3">
            <Field label="MWST-Status" hint="nipponnites ist aktuell nicht MWST-pflichtig.">
              <Select
                value={form.taxMode}
                onChange={(e) => set('taxMode', e.target.value as CompanySettings['taxMode'])}
              >
                <option value="none">Nicht MWST-pflichtig</option>
                <option value="effective">Effektive Methode</option>
                <option value="saldo">Saldosteuersatz</option>
              </Select>
            </Field>
            <Field label="Geschäftsjahr beginnt im Monat">
              <Select
                value={form.fiscalYearStartMonth}
                onChange={(e) => set('fiscalYearStartMonth', Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card title="Bankverbindung (für QR-Rechnung)">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank">
              <Input
                value={form.bank.name ?? ''}
                onChange={(e) => set('bank', { ...form.bank, name: e.target.value })}
              />
            </Field>
            <Field label="IBAN">
              <Input
                value={form.bank.iban ?? ''}
                onChange={(e) => set('bank', { ...form.bank, iban: e.target.value })}
              />
            </Field>
            <Field label="QR-IBAN" hint="Für QR-Rechnungen mit QR-Referenz.">
              <Input
                value={form.bank.qrIban ?? ''}
                onChange={(e) => set('bank', { ...form.bank, qrIban: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card title="Rechnungsvorgaben">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Zahlungsfrist (Tage)">
              <Input
                type="number"
                value={form.invoice.defaultPaymentTermDays}
                onChange={(e) =>
                  set('invoice', {
                    ...form.invoice,
                    defaultPaymentTermDays: Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Akzentfarbe">
              <Input
                type="color"
                className="h-10 w-20 p-1"
                value={form.invoice.accentColor}
                onChange={(e) =>
                  set('invoice', { ...form.invoice, accentColor: e.target.value })
                }
              />
            </Field>
            <div className="col-span-2">
              <Field label="Fusszeile">
                <Input
                  value={form.invoice.footerText}
                  onChange={(e) =>
                    set('invoice', { ...form.invoice, footerText: e.target.value })
                  }
                />
              </Field>
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={save.isPending}>
            Speichern
          </Button>
          {saved && <span className="text-sm text-green-600">Gespeichert.</span>}
        </div>
      </form>

      <Card title="Datensicherung" className="mt-6">
        <p className="text-sm text-slate-500">
          Lädt alle Daten (Konten, Buchungen, Kunden, Dokumente, Notizen, Shopify-Bestellungen,
          Einstellungen) als eine JSON-Datei herunter. Ohne die generierten PDFs und ohne
          Shopify-Schlüssel. Am besten regelmässig sichern.
        </p>
        <Button type="button" variant="secondary" className="mt-3" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Wird erstellt …' : 'Alle Daten exportieren (JSON)'}
        </Button>
      </Card>
    </>
  )
}
