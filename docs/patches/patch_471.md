# Patch 471

## Titel
AI-/Request-Robustheitsreste: harte Timeouts + konservativer Backoff im bestehenden Chat-/Provider-Flow

## Kontext
Nach den letzten Chat-/Provider-Nachfixes blieben drei bestätigte Robustheitsreste:
1) kein klarer harter Request-Timeout auf Orchestrator-Seite,
2) zu direkte Retry-Folgeversuche bei 429/503,
3) kleiner flow-naher Retry-Rest im Builder-Pfad.

## Änderungen (minimal, ohne Re-Design)

1) `lib/orchestrator/index.ts`
- Neuer harter Timeout pro Provider-Call: `ORCHESTRATOR_REQUEST_TIMEOUT_MS = 45_000`.
- Umsetzung über lokalen `AbortController` je Attempt; externes `signal` abortet weiterhin durch.
- Bei Key-Rotation-Retry (429/Rate-Limit) kleiner deterministischer Backoff: `ORCHESTRATOR_ROTATION_BACKOFF_MS = 350`.

2) `hooks/useChatAIFlow.ts`
- Builder-Retry (bestehender Pfad bei 429/503/timeout/network) wartet jetzt konservativ `BUILDER_RETRY_BACKOFF_MS = 700` vor dem zweiten Versuch.
- Delay ist abort-fähig und respektiert den bestehenden `AbortController`-Guard.

3) `lib/__tests__/orchestrator.test.ts`
- Regression ergänzt: Rotation-Retry feuert nicht sofort, sondern erst nach Backoff.
- Regression ergänzt: harter Timeout führt zu sauberem Abbruchresultat.

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
- Keine Broad-Refactors am Chat-/Provider-Flow.
- Kein neuer Retry-Mechanismus für alle Pfade; nur bestätigte Restpunkte minimal adressiert.
