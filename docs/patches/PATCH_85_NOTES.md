# Patch 85 Notes – EnhancedBuildScreen Hardening

Stand: 2026-02-12

## Ziel

Build-Screen stabiler & sicherer machen:

- keine Doppel-Starts durch schnellen Doppeltap
- keine state updates/alerts nach Unmount
- Logs nicht raw in UI/Clipboard (Secret-Redaction + Caps)
- Run-Link nur über guarded open
- ETA live aktualisieren

## Änderungen

### EnhancedBuildScreen
- Reentrancy-Guard (`buildInFlightRef`) für `onStartBuild`
- Unmount-Guard (`isMountedRef`) in allen async flows
- Live ETA Tick (1s) während ein Build aktiv ist
- Striktere Repo-Validierung (`owner/repo` + Zeichen-Regeln)
- Alerts/Text: best-effort redaction + truncation

### GitHub Actions Logs + Modal
- `useGitHubActionsLogs`: redaction + per-line cap bevor Logs in UI landen
- `BuildLogsModal`: defense-in-depth für Copy + Error-Text, Clipboard cap

### LogsAnalysisSection
- Run-Link nutzt `openRun()` (canOpenURL Guard)

## Optik
- ETA ist jetzt sichtbar “live”.
- Logs können `<redacted>`/`…<truncated>` Marker zeigen, falls Secrets/Monster-Zeilen vorhanden sind.

## Tests
- Keine neuen Tests in diesem Patch.
- `npm run typecheck`, `npm run lint:ci`, `npm run test:silent` sollten weiterhin grün sein.