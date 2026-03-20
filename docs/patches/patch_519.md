# Patch 519: AppInfo Secret-/Config-Backups verschluesselt und fachlich getrennt

## Kontext / Problem

Der bisherige AppInfo-Backup-Pfad hatte zwei gekoppelte Schwaechen:

1. Das bisherige `Full-Backup` exportierte Secrets/Tokens/Connection-Werte als Klartext-JSON.
2. Der Name `Full-Backup` suggerierte einen Projekt- oder Inhalts-Export, obwohl dieser Flow gar keine Projektdateien, keine Projektstruktur und keine Chats sichern sollte.
3. Nutzer konnten praktisch nur zwischen AI-/API-Konfiguration und einem Alles-oder-Nichts-Klartextdump waehlen; ein sauberer Secret-only- oder ehrlich benannter kombinierter Config+Secrets-Pfad fehlte.

Fachlich gehoeren Projektinhalte weiter in den vorhandenen ZIP-Export/-Import. Der AppInfo-Backup-Pfad soll nur lokale Konfiguration, Secrets und naheliegende Connection-Kontexte sichern.

## Umsetzung

- `lib/appInfoScopedBackup.ts`
  - fuehrt versionierte Backup-Vertraege fuer `secret-snapshot` und `config-secret-snapshot` ein,
  - verschluesselt Secret-Backups mit `AES-GCM` und per `PBKDF2-SHA-256` abgeleitetem Key,
  - validiert das verschluesselte Dateiformat, lehnt Legacy-Klartext-`k1w1-full-backup` explizit ab und erkennt Projektdatei-/Chat-Signaturen im Backup-JSON.
- `screens/AppInfoScreen/hooks/importExportHelpers.ts`
  - behaelt den bestehenden API-/KI-Konfig-Export bei,
  - exportiert/importiert verschluesselte Secret-/Config-Backups jetzt ueber den neuen Crypto-Helper.
- `screens/AppInfoScreen/hooks/useAppInfoScreen.ts`
  - ersetzt den alten `Full-Backup`-Flow durch drei ehrliche Pfade:
    - nur API-/KI-Konfiguration
    - nur Secrets/Tokens/Connections
    - optional kombiniert `AI-/KI-Konfiguration + Secrets/Connections`
  - importiert nur den definierten Scope zurueck und haelt Projektdateien/Chats explizit ausserhalb dieses Flows.
- `screens/AppInfoScreen/components/*` + `styles.ts`
  - neue Copy und neuer Passphrase/PIN-Modaltext fuer verschluesselte Backups,
  - klarer Hinweis, dass ZIP-Export/-Import weiterhin der Projektinhaltspfad bleibt.

## Tests / Regressionen

- neuer Test `__tests__/appInfoSecureBackup.test.ts` fuer:
  - verschluesselter Export ist kein Klartext-JSON
  - Roundtrip mit korrekter Passphrase
  - sauberer Fehler bei falscher Passphrase
  - sauberer Fehler bei beschaedigter Datei
  - Scope-Trennung zwischen Secret-only und Config+Secrets
  - explizite Legacy-Klartext-Ablehnung
  - API-/KI-Konfig-Export bleibt separat validierbar/sanitisierbar

## Nicht Teil dieses Patches

- keine Aenderungen am ZIP-Projekt-Export/-Import
- keine Build-/Preview-/Auth-/Workflow-Architektur-Aenderungen
- keine neue generische Storage-Architektur
