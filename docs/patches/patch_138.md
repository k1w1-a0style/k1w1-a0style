# Patch 138

Datum: **2026-02-15**

## Ziel
In-App einen schnellen **CI-Check** (TypeScript + ESLint) starten können – ohne sofort einen EAS-Build zu triggern.
Der Output soll direkt in der App sichtbar und kopierbar sein, damit du Fehler schnell an die KI zum Fixen geben kannst.

## Änderungen
### 1) Neuer GitHub Workflow: CI Lite
- Neuer Workflow: `.github/workflows/k1w1-ci-lite.yml`
  - `npm run typecheck`
  - `npm run lint:ci`
  - `job_id` wird im `run-name` eingebettet, damit die App den passenden Run zuverlässig findet.
  - Optionaler `autofix` Modus (ESLint `--fix` + guarded writeback), danach normaler Check.

### 2) Globaler Header-Button in der App
- Neuer Header Button **„✅“** (global) startet den CI Lite Workflow.
- UI zeigt:
  - Repo + Branch + `job_id`
  - „ESLint“/„Typecheck“ Status + Fund-Zähler
  - Logs live (wie beim Build Logs Viewer)
- Extra Aktionen:
  - **Open Run** (öffnet GitHub Actions Run)
  - **Autofix ESLint** (dispatcht CI Lite mit `autofix=true`)

### 3) Log-Modal erweitert (wiederverwendbar)
- `BuildLogsModal` unterstützt jetzt:
  - `title`
  - `topContent` (Zusammenfassung/Progress)
  - `extraPills` (z.B. Open Run / Autofix)

### 4) Shared Helper: Supabase Edge URL
- `lib/supabaseEdge.ts` extrahiert die Edge-URL Auflösung (Runtime URL → ENV → Config).
  - wird jetzt auch von `useGitHubActionsLogs` genutzt.

## Betroffene Dateien
- `components/CustomHeader.tsx`
- `components/CiLiteHeaderButton.tsx` (neu)
- `components/BuildLogsModal.tsx`
- `hooks/useGitHubActionsLogs.ts`
- `lib/supabaseEdge.ts` (neu)
- `.github/workflows/k1w1-ci-lite.yml` (neu)

## Verifikation
Lokal ausgeführt (CI-äquivalent):
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent` ✅

Hinweis: Der neue CI Lite Workflow wird im echten Repo über GitHub Actions verifiziert.
