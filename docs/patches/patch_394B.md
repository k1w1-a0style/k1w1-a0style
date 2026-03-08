# Patch 394B

## Ziel
Manuelle Build-Trigger expliziter und reproduzierbarer machen, ohne die sichere Default-Policy aus 394A aufzuweichen.

## Änderungen
- `.github/workflows/k1w1-triggered-build.yml`
  - ergänzt manuelle Inputs `autofix` und `strict_lockfile`
  - reicht Werte nur für `workflow_dispatch` an das reusable `eas-build.yml` weiter
- `.github/workflows/eas-build.yml`
  - ergänzt `strict_lockfile` als Input für `workflow_dispatch` und `workflow_call`
  - unterstützt Override-Werte `auto|true|false`
  - behält `auto` als sicheren Standard bei
- `lib/diagnostics/workflowTemplates.ts`
  - synchronisiert Trigger-/Build-Template auf denselben Input-Vertrag
- `scripts/check_eas_manual_trigger_controls.sh`
  - Guard-Script für die neuen Inputs/Overrides

## Warum
Patch 394A hat die Lockfile-Policy gehärtet. 394B macht diese Policy jetzt bewusst steuerbar, ohne aus Versehen Preview/Production zu entschärfen.

## Checks
```bash
bash scripts/check_eas_manual_trigger_controls.sh
npm run typecheck
npm run lint:ci
npm run test:silent
```
