# nipponnites Buchhaltung

Schlanke Buchhaltungs- und Fakturierungs-Web-App für nipponnites (Schweizer Shopify-Shop,
CHF, aktuell nicht MWST-pflichtig, einfache Einnahmen-/Ausgabenrechnung).

Plan: `../.claude/plans/lasen-wir-was-planen-sprightly-blossom.md`

## Tech

- **React 19 + TypeScript + Vite**, Tailwind CSS v4
- **Firebase**: Auth, Firestore, Storage, Hosting, Cloud Functions (Region `europe-west6`)
- **PDF**: `@react-pdf/renderer` (clientseitig, deterministisch)
- **QR-Rechnung**: `swissqrbill`
- **E-Mail**: Resend (via Cloud Function)

## Projektstatus

| Phase | Inhalt | Status |
|---|---|---|
| 0 | Gerüst, Firebase-Config, Auth, CI, Kontenrahmen-Daten | ✅ |
| 1 | Kontenplan, Buchungen, Dashboard, Einstellungen | ✅ Grundfunktionen |
| 1 | Beleg-Upload, Eröffnungssaldi, Onboarding-Assistent | ⏳ |
| 2 | Kunden, Offerten/Rechnungen, PDF-Vorlage, QR-Rechnung, Versand | ⏳ |
| 3 | Shopify-Integration | ⏳ (Function-Gerüst vorhanden) |
| 4 | Auswertungen, CSV-Import, Notizen | ⏳ |
| 5 | Jahresabschluss, Periodensperre, Backup/Export | ⏳ (Backup-Function vorhanden) |
| 6 | Mahnwesen, wiederkehrende Rechnungen, Mehrsprachigkeit, 2FA, PWA | ⏳ |

## Lokale Entwicklung

```bash
npm install
cp .env.example .env.local   # Werte aus der Firebase-Konsole eintragen
npm run dev
```

Mit Firebase-Emulatoren (braucht ein JDK 11+):

```bash
npm run emulators      # Auth:9099  Firestore:8080  Functions:5001  Storage:9199  UI:4000
# in .env.local: VITE_USE_EMULATORS=1
npm run dev
```

## Einmalige Einrichtung (durch Fabio)

1. **Firebase-Projekt** anlegen: <https://console.firebase.google.com> → Projekt
   `nipponnites-buchhaltung`.
2. Auf **Blaze-Plan** upgraden (Kreditkarte). Danach unter
   *Abrechnung → Budgets & Warnungen* ein Budget von **CHF 1** mit E-Mail-Warnung anlegen.
3. **Authentication** → *E-Mail/Passwort* aktivieren → einen einzigen Benutzer anlegen
   (deine E-Mail). Die UID dieses Benutzers kopieren.
4. Diese UID in **`firestore.rules`** und **`storage.rules`** anstelle von
   `REPLACE_WITH_OWNER_UID` eintragen.
5. **Web-App** registrieren (Projekteinstellungen → Meine Apps), Config-Werte in die
   GitHub-Secrets eintragen (siehe unten).
6. **Firestore** und **Storage** in der Konsole initialisieren (Region `europe-west6`).
7. Custom-Domain `buchhaltung.nipponnites.ch` in Firebase Hosting verbinden (optional).

### GitHub-Secrets für den Auto-Deploy

| Secret | Wert |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON eines Service-Accounts mit den Rollen *Firebase Admin* + *Cloud Functions Admin* + *Service Account User* |
| `VITE_FIREBASE_API_KEY` … `VITE_FIREBASE_APP_ID` | aus der Web-App-Config |

Danach deployt jeder Push auf `main` automatisch (`.github/workflows/deploy.yml`).

### Integrations-Secrets (nach dem ersten Deploy)

In Firestore das Dokument `secrets/integrations` anlegen (nur via Konsole/Admin):

```
shopifyWebhookSecret : <aus der Shopify Custom App>
shopifyAdminToken    : <aus der Shopify Custom App>
resendApiKey         : <resend.com API Key>
mailFrom             : "nipponnites <rechnung@nipponnites.ch>"
```

Für Resend die Absenderdomain verifizieren (SPF-/DKIM-Einträge im DNS von nipponnites.ch),
sonst landen Rechnungen im Spam.

## Ordnerstruktur

```
src/
  lib/          firebase, auth, db-helper, formatierung, typen
  data/         Kontenrahmen KMU
  hooks/        react-query hooks (accounts, transactions, settings)
  components/   AppShell, UI-Primitive
  pages/        eine Datei pro Route
functions/src/  shopifyWebhook, sendDocumentEmail, weeklyBackup
```
