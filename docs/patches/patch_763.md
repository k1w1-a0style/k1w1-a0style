# Patch 763

## Titel
Workflow-Contract-Robustheit + SoT-Drift-Nachzug

## Kontext
Dieser Patch schliesst den engen Restpunkt-Block rund um Contract-Check-Fragilitaet und SoT-Drift, ohne den bestehenden Security-/RBAC-Vertrag weichzuspuelen.

## Aenderungen
1. `scripts/check_workflow_edge_contracts.sh`
   - neue Helper-Funktion `require_operator_claim_contract` eingefuehrt
   - fragilere `require_fixed`-Vollsatzpruefungen auf semantische Markerbuendel reduziert
   - Auth-/Operator-Contract bleibt strikt (`build_admin`, `service_role`, `Server-Caller`, externe Claim-Provisionierung etc.)
2. SoT-Sync
   - Stand-/Patch-Header auf Patch 763 gezogen: `README`, `TODO`, `Review`, `INDEX`, `TESTING_GUIDE`, `FRESH_CHECKOUT_GREEN_PATH`, `EDGE_FUNCTIONS_STATUS`
   - Checklog/Patchlog auf aktuellen Patch erweitert
3. Hygiene-Bewertung
   - Produktiver Scope erneut auf `console.log` geprueft; kein offensichtlicher direkter Runtime-Rest ausser zentraler Logger-Fassade.

## Verifikation (lokal)
- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_verify_jwt_visibility.sh`
- `bash scripts/check_release_readiness.sh`
- `bash scripts/check_patch_docs_sync.sh`

## Ergebnis
- Contract-Checks bleiben hart, sind aber deutlich weniger anfällig fuer kosmetische Copy-Aenderungen.
- Fuehrende SoT ist wieder mit dem echten Stand synchron.
- Kein neuer Grossumbau; Rest-Hotspots bleiben separat planbar.
