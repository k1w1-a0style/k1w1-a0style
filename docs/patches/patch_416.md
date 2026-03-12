# Patch 416 - disable legacy lint/native-sync edge deployments

## Ziel
Die absichtlich stillgelegten Legacy-Edge-Funktionen sollen nicht nur zur Laufzeit 410 liefern, sondern auch in `supabase/config.toml` als **deaktiviert** markiert sein, damit kein unnötiger Deploy-/Operations-Drift mehr besteht.

## Änderungen
- `supabase/config.toml`
  - `enabled = false` für:
    - `trigger-lint`
    - `check-lint`
    - `trigger-native-sync`
    - `check-native-sync`
    - `native-sync-report`
    - `native-sync-report-ingest`
- `scripts/check_legacy_disabled_edges.sh`
  - prüft die deaktivierten Config-Einträge plus die 410-Stub-Verträge
- `.github/workflows/workflow-lint.yml`
  - führt den neuen Guard-Script mit aus
- `__tests__/patch416.legacyEdgeDisablement.invariants.test.ts`
  - hält Config-/Stub-/Workflow-Lint-Vertrag gegen Drift fest
- Doku synchronisiert:
  - `README.md`
  - `docs/TODO.md`
  - `PROJECT_CHECKLOG.md`
  - `docs/patches/PATCHLOG_ROOT.md`
  - `docs/EDGE_FUNCTIONS_STATUS.md`
  - `.github/workflows/README.md`

## Warum
Die sechs Legacy-Funktionen waren fachlich längst stillgelegt, aber in der Supabase-Konfiguration noch deploy-aktiv. Patch 416 zieht die operative Wahrheit (`enabled = false`) auf den dokumentierten Status nach und hält die 410-Stubs als explizite Legacy-Failsafes fest.

## Prüfen
```bash
bash scripts/check_legacy_disabled_edges.sh
npm run typecheck
npm run lint:ci
npm run test:silent
```
