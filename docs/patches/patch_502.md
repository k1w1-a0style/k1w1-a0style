# Patch 502 — Prompt-/Write-Contract ehrlich an Chat-Ownership gekoppelt

## Ziel
Prompt-Hinweise im KI-Flow so an die reale Chat-Ownership-/Apply-Policy koppeln, dass Planner/Builder/Validator keine normalen Writes fuer Pfade suggerieren, die der echte Chat-Guard spaeter blockiert.

## Umsetzung
- `lib/effectiveWritePolicy.ts`
  - Prompt-Hinweise nicht mehr aus der groben Config-Allowlist abgeleitet.
  - Normale Chat-Schreibbereiche stattdessen ueber explizite realistische Chat-Guard-Probes bestimmt.
  - Guarded-Beispiele fuer kritische/manual-only und baseline-verwaltete Pfade direkt ueber `canActorModifyPath('chat', ...)` klassifiziert.
- `lib/promptEngine.ts`
  - Prompttexte fuer Planner/Builder/Validator sagen jetzt explizit, dass nur ein priorisierter, gekuerzter Snapshot vorliegt.
  - Snapshot-Block benennt sich als priorisierter Ausschnitt und weist darauf hin, dass nicht gezeigte Pfade fehlen koennen.
- `__tests__/aiFlowPrivacyContract.test.ts`
  - Regressionen fuer Policy-Sync, manual-only/baseline-Markierung und Snapshot-Ehrlichkeit erweitert.

## Guard-/Contract-Status
- Keine Ownership-Policy geloesert.
- Keine Apply-Guards geaendert.
- Nur Prompt-/Contract-Ehrlichkeit an die bestehende Chat-Haerte angepasst.

## Checks
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
