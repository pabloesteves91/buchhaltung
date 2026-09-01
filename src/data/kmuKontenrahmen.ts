import type { AccountType } from '@/lib/types'

export interface SeedAccount {
  number: string
  name: string
  group: string
  isSystem?: boolean
}

/** Derive the account type from the leading digit of the KMU account number. */
export function accountTypeFromNumber(number: string): AccountType {
  const first = number[0]
  if (first === '1') return 'aktiven'
  if (first === '2') return 'passiven'
  if (first === '3' || first === '7') return 'ertrag'
  if (first === '4' || first === '5' || first === '6' || first === '8') return 'aufwand'
  // 8xxx is mixed (Aufwand & Ertrag); 9xxx is closing – treated per-account below.
  return 'aufwand'
}

/**
 * Standard Kontenrahmen KMU (veb.ch), trimmed to what a small Swiss e-commerce
 * business that is NOT VAT-registered actually needs. The user can add the rest
 * from the Kontenplan screen at any time.
 */
export const KMU_KONTENRAHMEN: SeedAccount[] = [
  // --- 1 Aktiven --------------------------------------------------------------
  { number: '1000', name: 'Kasse', group: 'Umlaufvermögen', isSystem: true },
  { number: '1020', name: 'Bankguthaben', group: 'Umlaufvermögen', isSystem: true },
  { number: '1021', name: 'Bankguthaben 2', group: 'Umlaufvermögen' },
  { number: '1023', name: 'PayPal', group: 'Umlaufvermögen' },
  { number: '1025', name: 'Shopify Payments (Zahlungsanbieter-Guthaben)', group: 'Umlaufvermögen' },
  { number: '1090', name: 'Geldtransit', group: 'Umlaufvermögen', isSystem: true },
  { number: '1100', name: 'Forderungen aus Lieferungen und Leistungen (Debitoren)', group: 'Umlaufvermögen', isSystem: true },
  { number: '1109', name: 'Delkredere (Wertberichtigung Debitoren)', group: 'Umlaufvermögen' },
  { number: '1140', name: 'Vorschüsse und Darlehen', group: 'Umlaufvermögen' },
  { number: '1170', name: 'Vorsteuer MWST Material, Waren, Dienstleistungen', group: 'Umlaufvermögen' },
  { number: '1171', name: 'Vorsteuer MWST Investitionen, übriger Betriebsaufwand', group: 'Umlaufvermögen' },
  { number: '1176', name: 'Verrechnungssteuer-Guthaben', group: 'Umlaufvermögen' },
  { number: '1200', name: 'Handelswaren (Warenlager)', group: 'Umlaufvermögen' },
  { number: '1300', name: 'Bezahlter Aufwand des Folgejahres (aktive Rechnungsabgrenzung)', group: 'Umlaufvermögen' },
  { number: '1301', name: 'Noch nicht erhaltener Ertrag (aktive Rechnungsabgrenzung)', group: 'Umlaufvermögen' },
  { number: '1500', name: 'Maschinen und Apparate', group: 'Anlagevermögen' },
  { number: '1510', name: 'Mobiliar und Einrichtungen', group: 'Anlagevermögen' },
  { number: '1520', name: 'Büromaschinen, Informatik, Kommunikationstechnik', group: 'Anlagevermögen' },
  { number: '1526', name: 'Software', group: 'Anlagevermögen' },
  { number: '1530', name: 'Fahrzeuge', group: 'Anlagevermögen' },

  // --- 2 Passiven -----------------------------------------------------------
  { number: '2000', name: 'Verbindlichkeiten aus Lieferungen und Leistungen (Kreditoren)', group: 'Kurzfristiges Fremdkapital', isSystem: true },
  { number: '2100', name: 'Bankverbindlichkeiten (kurzfristig)', group: 'Kurzfristiges Fremdkapital' },
  { number: '2120', name: 'Verbindlichkeiten aus Finanzierungsleasing', group: 'Kurzfristiges Fremdkapital' },
  { number: '2200', name: 'Geschuldete MWST (Umsatzsteuer)', group: 'Kurzfristiges Fremdkapital' },
  { number: '2201', name: 'Abrechnungskonto MWST', group: 'Kurzfristiges Fremdkapital' },
  { number: '2206', name: 'Verrechnungssteuer (geschuldet)', group: 'Kurzfristiges Fremdkapital' },
  { number: '2261', name: 'Beschlossene Ausschüttungen', group: 'Kurzfristiges Fremdkapital' },
  { number: '2270', name: 'Verbindlichkeiten Sozialversicherungen', group: 'Kurzfristiges Fremdkapital' },
  { number: '2300', name: 'Noch nicht bezahlter Aufwand (passive Rechnungsabgrenzung)', group: 'Kurzfristiges Fremdkapital' },
  { number: '2301', name: 'Erhaltene Anzahlungen / vorausbezahlter Ertrag', group: 'Kurzfristiges Fremdkapital' },
  { number: '2330', name: 'Kurzfristige Rückstellungen', group: 'Kurzfristiges Fremdkapital' },
  { number: '2400', name: 'Bankdarlehen (langfristig)', group: 'Langfristiges Fremdkapital' },
  { number: '2450', name: 'Darlehen (langfristig)', group: 'Langfristiges Fremdkapital' },
  { number: '2600', name: 'Rückstellungen (langfristig)', group: 'Langfristiges Fremdkapital' },
  { number: '2800', name: 'Eigenkapital / Grundkapital', group: 'Eigenkapital', isSystem: true },
  { number: '2850', name: 'Privatkonto', group: 'Eigenkapital' },
  { number: '2900', name: 'Gesetzliche Gewinnreserve', group: 'Eigenkapital' },
  { number: '2970', name: 'Gewinnvortrag / Verlustvortrag', group: 'Eigenkapital', isSystem: true },
  { number: '2979', name: 'Jahresgewinn oder Jahresverlust', group: 'Eigenkapital', isSystem: true },

  // --- 3 Betrieblicher Ertrag ---------------------------------------------
  { number: '3200', name: 'Handelserlöse (Warenverkauf)', group: 'Betrieblicher Ertrag', isSystem: true },
  { number: '3201', name: 'Handelserlöse Shopify', group: 'Betrieblicher Ertrag' },
  { number: '3400', name: 'Dienstleistungserlöse', group: 'Betrieblicher Ertrag' },
  { number: '3600', name: 'Übrige Erlöse aus Lieferungen und Leistungen', group: 'Betrieblicher Ertrag' },
  { number: '3660', name: 'Versandkosten weiterverrechnet', group: 'Betrieblicher Ertrag' },
  { number: '3800', name: 'Erlösminderungen (Rabatte, Skonti)', group: 'Betrieblicher Ertrag' },
  { number: '3805', name: 'Verluste aus Forderungen (Debitorenverluste)', group: 'Betrieblicher Ertrag' },
  { number: '3806', name: 'Rückerstattungen / Retouren', group: 'Betrieblicher Ertrag' },
  { number: '3900', name: 'Bestandesänderungen Handelswaren', group: 'Betrieblicher Ertrag' },

  // --- 4 Waren- / Materialaufwand ----------------------------------------
  { number: '4200', name: 'Handelswarenaufwand (Einkauf)', group: 'Warenaufwand', isSystem: true },
  { number: '4400', name: 'Aufwand für bezogene Drittleistungen', group: 'Warenaufwand' },
  { number: '4500', name: 'Energieaufwand zur Leistungserstellung', group: 'Warenaufwand' },
  { number: '4900', name: 'Einkaufsrabatte und -skonti (Aufwandminderung)', group: 'Warenaufwand' },
  { number: '4901', name: 'Bezugskosten / Einfuhrzölle', group: 'Warenaufwand' },

  // --- 5 Personalaufwand -------------------------------------------------
  { number: '5000', name: 'Lohnaufwand', group: 'Personalaufwand' },
  { number: '5700', name: 'Sozialversicherungsaufwand', group: 'Personalaufwand' },
  { number: '5800', name: 'Übriger Personalaufwand', group: 'Personalaufwand' },
  { number: '5820', name: 'Aus- und Weiterbildung', group: 'Personalaufwand' },

  // --- 6 Übriger betrieblicher Aufwand ---------------------------------
  { number: '6000', name: 'Raumaufwand (Miete)', group: 'Übriger Betriebsaufwand' },
  { number: '6100', name: 'Unterhalt, Reparaturen, Ersatz Mobilien', group: 'Übriger Betriebsaufwand' },
  { number: '6105', name: 'Leasingaufwand mobile Sachanlagen', group: 'Übriger Betriebsaufwand' },
  { number: '6200', name: 'Fahrzeug- und Transportaufwand', group: 'Übriger Betriebsaufwand' },
  { number: '6260', name: 'Fahrzeugleasing und -miete', group: 'Übriger Betriebsaufwand' },
  { number: '6300', name: 'Sachversicherungen, Abgaben, Gebühren, Bewilligungen', group: 'Übriger Betriebsaufwand' },
  { number: '6400', name: 'Energie- und Entsorgungsaufwand', group: 'Übriger Betriebsaufwand' },
  { number: '6500', name: 'Büromaterial und Drucksachen', group: 'Übriger Betriebsaufwand' },
  { number: '6510', name: 'Telefon, Porto', group: 'Übriger Betriebsaufwand' },
  { number: '6513', name: 'Porto und Versandkosten', group: 'Übriger Betriebsaufwand' },
  { number: '6570', name: 'Informatikaufwand (Software-Abos, Hosting, IT)', group: 'Übriger Betriebsaufwand' },
  { number: '6600', name: 'Werbeaufwand', group: 'Übriger Betriebsaufwand' },
  { number: '6610', name: 'Online-Marketing (Ads, Social Media)', group: 'Übriger Betriebsaufwand' },
  { number: '6640', name: 'Reise- und Repräsentationsspesen', group: 'Übriger Betriebsaufwand' },
  { number: '6700', name: 'Sonstiger betrieblicher Aufwand', group: 'Übriger Betriebsaufwand' },
  { number: '6710', name: 'Shopify-Gebühren und Transaktionskosten', group: 'Übriger Betriebsaufwand' },
  { number: '6720', name: 'Zahlungsverkehr / Kreditkartengebühren', group: 'Übriger Betriebsaufwand' },
  { number: '6800', name: 'Abschreibungen auf Sachanlagen', group: 'Abschreibungen' },
  { number: '6900', name: 'Finanzaufwand (Zinsen, Bankspesen)', group: 'Finanzergebnis' },
  { number: '6940', name: 'Bankspesen', group: 'Finanzergebnis' },
  { number: '6950', name: 'Finanzertrag (Zinsertrag)', group: 'Finanzergebnis' },
  { number: '6960', name: 'Währungsdifferenzen (Kursverluste/-gewinne)', group: 'Finanzergebnis' },

  // --- 8 Ausserordentlich / betriebsfremd / Steuern -------------------
  { number: '8000', name: 'Betriebsfremder Aufwand', group: 'Ausserordentlich / Steuern' },
  { number: '8100', name: 'Betriebsfremder Ertrag', group: 'Ausserordentlich / Steuern' },
  { number: '8500', name: 'Ausserordentlicher, einmaliger oder periodenfremder Aufwand', group: 'Ausserordentlich / Steuern' },
  { number: '8510', name: 'Ausserordentlicher, einmaliger oder periodenfremder Ertrag', group: 'Ausserordentlich / Steuern' },
  { number: '8900', name: 'Direkte Steuern (Gewinn- und Kapitalsteuern)', group: 'Ausserordentlich / Steuern' },
]

/** Accounts on the 8xxx range that are actually Ertrag, not Aufwand. */
const ERTRAG_OVERRIDES = new Set(['8100', '8510'])

export function resolvedAccountType(number: string): AccountType {
  if (ERTRAG_OVERRIDES.has(number)) return 'ertrag'
  return accountTypeFromNumber(number)
}
