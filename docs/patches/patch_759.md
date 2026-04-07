# Patch 759 — Hotspot-Master-Plan (Analyse-only, kein Grossumbau)

## Ziel
Die bewusst verschobenen Refactor-/Wartbarkeits-Hotspots vollstaendig gegen den aktuellen Stand bestaetigen und in einen konkreten, umsetzbaren Zerlegeplan ueberfuehren.

## Umsetzung
- Neuer Master-Plan: `docs/reviews/hotspot_master_plan_2026-04-07.md`
  - deckt alle bekannten Hotspots ab (`ConnectionsScreenRefactor`, `ProjectContextRefactor`, `LocalRemoteDiffSectionRefactor`, `SecretsSectionRefactor`, `CiLiteWorkflowFurtherSplit`, `DiagnosticScreenFurtherSplit`),
  - erweitert nur um echte zusaetzliche Hotspots im selben Scope (`useChatAIFlow`, `managedWorkflowTemplates`),
  - liefert pro Hotspot: Befund, konkrete Ziel-Dateistruktur, Orchestrator-Zielbild, Risiken, Testschutz und Schrittfolge,
  - enthaelt klare Priorisierung und klare Umsetzungsstrategie (hotspotweise, mehrstufig, nicht parallel).
- `docs/TODO.md` verlinkt den neuen Master-Plan direkt am bestehenden Wartbarkeits-Block.

## Tests/Checks
- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s docs:lint`
- `bash scripts/check_patch_docs_sync.sh`

## Nicht-Ziele
- Keine Runtime-/Produktlogik-Aenderung.
- Kein Hook-/Context-/Architektur-Umbau in dieser Runde.
