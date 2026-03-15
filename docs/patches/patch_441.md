# Patch 441

Datum: 2026-03-15

## Ziel
Gezieltes UX-Feintuning nur für die drei Kernscreens **BuildScreen**, **DiagnosisScreen** und **Preview**, ohne Architekturumbau.

## Änderungen
- **BuildScreen** (`screens/EnhancedBuildScreen/components/BuildStatusSection.tsx`, `screens/EnhancedBuildScreen/components/OneClickDeployCard.tsx`)
  - Status-/Kontexttexte alltagsnäher formuliert (klarer Unterschied Auswahl vs. laufender Build).
  - Button-/Action-Wording enttechnisiert (z. B. „APK herunterladen“, „Build jetzt starten“, „Build-Autoflow“).
- **DiagnosisScreen** (`screens/DiagnosticScreen/components/HeaderSection.tsx`, `screens/DiagnosticScreen/index.tsx`)
  - Aktionen und Sektionstitel verständlicher benannt („Prüfen“, „Auto-Fix“, „Bericht“, „Prüf-Ergebnisse“).
  - Hinweistext zur gespeicherten Auswahl klarer, Busy-Text weniger intern formuliert.
- **Preview** (`screens/PreviewScreen/components/PreviewStatusBar.tsx`, `screens/PreviewScreen/PreviewScreen.tsx`)
  - Status-Labels auf klarere Semantik für Erstellung/Laden/Live/Fallback/Fehler vereinheitlicht.
  - Link-Karte weniger technisch benannt („Preview-Link (Browser & QR)").

## Tests
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Hinweis
Zusätzlich wurden bestehende Invariant-/Status-Text-Tests auf die neuen, konsistenten Begriffe aktualisiert (`__tests__/buildTraceability.transparency.invariants.test.ts`, `__tests__/previewStatusBar.statusText.test.ts`).
