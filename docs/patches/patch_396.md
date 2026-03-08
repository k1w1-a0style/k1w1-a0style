# Patch 396 - production credential hardening + sanitized diagnostics

## Goal

Härtet den Production-Keystore-/Credential-Pfad in `eas-build.yml`, damit Keystore-Export-Fehler sauberer diagnostizierbar sind und temporäre Signing-Dateien nicht liegen bleiben.

## Changes

- `.github/workflows/eas-build.yml`
  - erzeugt `ci-logs/` für EAS-/Keystore-Diagnostik
  - maskiert Secrets vor dem Keystore-Export
  - schreibt eine strukturierte Keystore-Request-Datei
  - verwendet `curl` mit Retry/Timeout und HTTP-Code-Erfassung
  - validiert die Export-Antwort strukturell vor `writeAndroidSigningFilesFromExport.js`
  - lädt sanitisierte Diagnostik-Artefakte hoch
  - löscht Signing-Dateien und Rohantwort immer im Cleanup
- `lib/diagnostics/workflowTemplates.ts`
  - synchronisiert den EAS-Workflow-Template-Stand
- `.github/workflows/README.md`
  - dokumentiert den härteren Production-Credential-Flow

## Why this matters

Production-Builds sollten Keystore-/Credential-Probleme nicht nur mit einem nackten `curl`-Fehler quittieren.
Mit diesem Patch werden Exportfehler, ungültige Payloads und Cleanup-Verhalten nachvollziehbarer, ohne rohe Secrets in Logs oder Artefakten zu hinterlassen.
