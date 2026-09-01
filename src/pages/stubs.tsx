import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/ui'

function Stub({ title, subtitle, phase }: { title: string; subtitle: string; phase: string }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <EmptyState title="In Arbeit" description={`Dieses Modul kommt in ${phase}.`} />
    </>
  )
}

export const ShopifyPage = () => (
  <Stub
    title="Shopify"
    subtitle="Bestellungen als Belege übernehmen, Retouren als Gutschrift."
    phase="Phase 3 (Shopify)"
  />
)

export const ReportsPage = () => (
  <Stub
    title="Auswertungen"
    subtitle="Statistiken, Jahresvergleich und Jahresabschluss."
    phase="Phase 4/5"
  />
)

export const NotesPage = () => (
  <Stub
    title="Notizen"
    subtitle="Freie Notizen, auch verknüpft mit Buchungen oder Kunden."
    phase="Phase 4"
  />
)
