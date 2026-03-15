# Patch 442

Datum: 2026-03-15

## Ziel
Gezieltes Feintuning der **Build-Status-/Progress-/Phasenkommunikation** im `EnhancedBuildScreen`, damit aktiver Lauf, letzte bekannte Daten und reine Auswahl klarer getrennt sind — ohne Backend-/Polling-/Flow-Umbau.

## Änderungen
- **Status-Kommunikation** (`screens/EnhancedBuildScreen/hooks/statusCommunication.ts`)
  - Kontextlabel für gespeicherte Build-Daten präzisiert: „Letzter bekannter Build-Kontext (kein Live-Status)“.
- **Build-Status-Karte** (`screens/EnhancedBuildScreen/components/BuildStatusSection.tsx`)
  - Laufender Build vs. letzter bekannter Build explizit getrennt (`isBuildRunning`, `hasLastBuildContext`).
  - Job-Zeile semantisch präzisiert („Aktiver Build-Job“ vs. „Letzter bekannter Build-Job“).
  - Hinweis ergänzt, dass Run-/Artifact-/Download-Links im Ruhemodus zum **letzten bekannten Build-Ergebnis** gehören.
  - Aktionslabels kontextabhängig beruhigt: „Aktiver GitHub-Run“/„Letzter GitHub-Run“, „Aktive Artefakte“/„Letzte Artefakte“, Download-CTA mit „wenn fertig“ statt falschem Live-Eindruck.
- **Build-Phasen-Karte** (`screens/EnhancedBuildScreen/components/BuildProgressSection.tsx`)
  - Überschrift unter Status um aktive Dimension klarer zu machen („Aktive Build-Phase“, „Aktive Vorbereitungsphase“, „Phasenübersicht“).
  - Aktive Phase zusätzlich textlich markiert („Jetzt aktiv“), damit done/current/upcoming schneller unterscheidbar sind.
- **Tests** (`__tests__/buildScreen.statusCommunication.test.ts`)
  - Erwartung auf neues Kontextlabel aktualisiert.

## Verifikation
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Hinweis
Keine neue Prozent-/ETA-Logik und keine Änderung an Build-Orchestrierung, Polling, Supabase-Edges oder Workflow-Templates.
