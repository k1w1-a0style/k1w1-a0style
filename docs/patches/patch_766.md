# Patch 766 — Scope-/Live-Contract-Truthfulness-Finish

## Kontext
Der aktuelle PR-/Repo-Stand ist breiter als eine reine CI-Lite-Teilgeschichte. Parallel gab es einen bekannten Live-Drift-Hinweis fuer `preview_page` (Legacy-Text `Missing ?secret=...` statt Header-Contract), der deploy-seitig eingegrenzt werden muss.

## Umsetzung (Repo)
1. `scripts/check_edge_live_contracts.sh` wurde vertraglich geschaerft:
   - bestehende Live-Pruefung fuer `k1w1-handler` (`400 invalid_request_payload`) bleibt erhalten
   - `preview_page` erkennt Legacy-Drift explizit (`Missing ?secret=...`) mit klarer Redeploy-Hinweismeldung
   - neuer `save_preview`-Live-Contract:
     - JWT + minimaler Payload => HTTP 200 + `ok:true`
     - `previewUrl` muss `transport=fragment#secret=` enthalten
     - Query-`?secret=` wird fail-closed geblockt
2. SoT-/Status-Dokumente auf Patch-766-Stand synchronisiert (README/INDEX/TODO/TESTING_GUIDE/FRESH_CHECKOUT/Review/Checklog/Patchlog).

## Wahrheit/Abgrenzung
- Dieser Patch ersetzt keinen echten Live-Deploy ohne Operator-Zugang.
- Wenn Live weiter Legacy-`?secret=` liefert, bleibt das ein Deployment-Drift (nicht Repo-Code-Drift).
- Kein Query-Secret-Revival, kein Sicherheits-Downscope.

## Validierung
- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_verify_jwt_visibility.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run -s docs:lint`
- `bash scripts/check_release_readiness.sh` (`OK_WITH_SKIPS` ohne `EDGE_BASE_URL`/`EDGE_OPERATOR_JWT` in dieser Shell)
- `bash scripts/check_edge_live_contracts.sh` (fails fast ohne gesetzte Live-Env)
