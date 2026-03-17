# Patch 472

## Titel
AI-/Request-Follow-up: echter harter Orchestrator-Request-Timeout über den gesamten Call-Lauf

## Kontext
Nach PR #288 war der Builder-Retry bereits sinnvoll verbessert (Backoff + abort-aware cleanup).
Der verbleibende Hauptrestpunkt war ein echter harter Timeout über den gesamten `runOrchestrator(...)`-Lauf:
bei Rotationen/Retry durfte das Gesamtbudget nicht je Attempt neu starten.

## Änderungen (minimal, ohne Re-Design)

1) `lib/orchestrator/index.ts`
- Hard-Deadline pro `runOrchestrator(...)`-Aufruf ergänzt (`startMs + ORCHESTRATOR_REQUEST_TIMEOUT_MS`).
- Vor jedem Attempt wird `remainingMs` berechnet; bei abgelaufenem Budget wird sofort ein klares Timeout-Resultat zurückgegeben.
- Attempt-Timeout nutzt jetzt `remainingMs` statt immer des vollen Timeout-Werts.
- Bei timeout-ausgelöstem Abort wird deterministisch ein Timeout-Fehlertext (`Request timeout nach ...ms`) geliefert.
- Bestehende Guards bleiben intakt: externer `AbortSignal`, Key-Rotation, Provider-Fallback-Verhalten.

2) `lib/__tests__/orchestrator.test.ts`
- Timeout-Regression auf den neuen klaren Timeout-Pfad angepasst (`/timeout/i` statt generischem Abort-Match).

## Verifikation
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Offene Punkte
- Kein Broad-Refactor des Chat-/Provider-Flows.
- Keine neue Retry-Architektur; nur der verbleibende Timeout-Hauptrestpunkt wurde final geschlossen.
