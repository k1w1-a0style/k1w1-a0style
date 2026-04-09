# Patch 767 — ReleaseReadinessToolingRobustness + Live-Variable-SoT-Finish

## Kontext
Der Abschlusslauf hatte noch zwei echte Restpunkte:
1. `check_release_readiness.sh` war lokal fragil bei fehlendem globalen `tsc`.
2. Live-Variablen-/Secret-Bezug fuer `EDGE_BASE_URL`/`EDGE_OPERATOR_JWT` sollte in Runbooks/Testing klarer und praktischer dokumentiert sein (ohne Secret-Leaks).

## Umsetzung
1. **Tooling-Robustheit**
   - `scripts/check_release_readiness.sh` nutzt fuer strict/edge TypeScript jetzt `run_repo_tsc()`:
     - primaer `./node_modules/.bin/tsc`
     - fallback `npx tsc`
   - Keine Checks entfernt, keine Weichspuelung, nur robustere Aufrufmechanik.

2. **Live-Variable-SoT / Runbooks**
   - `docs/TESTING_GUIDE.md`, `docs/runbooks/APP_RUNBOOK.md`, `docs/runbooks/OPERATOR_SETUP_CHECKLIST.md`, `docs/runbooks/OPERATOR_EXECUTION_CHECKLIST.md` ergaenzt/geschärft:
     - benoetigte Variablen: `EDGE_BASE_URL`, `EDGE_OPERATOR_JWT`
     - sichere Quellen: masked Runner-Secrets bevorzugt
     - lokaler URL-Fallback ueber Projekt-Ref `xfgnzpcljsuqqdjlxgul`
     - JWT nur sicher/kurzlebig bzw. technisch stabil ueber Runner-Secret, nie als Klartext im Repo.

3. **Scope-/Truthfulness-SoT**
   - Stand-/Patch-Header auf Patch 767 synchronisiert (`README`, `INDEX`, `TODO`, `TESTING_GUIDE`, `FRESH_CHECKOUT`, `EDGE_FUNCTIONS_STATUS`, `Review`, `PROJECT_CHECKLOG`, `PATCHLOG_ROOT`).
   - Frueherer `preview_page`-Legacy-Deploy-Drift (`Missing ?secret=...`) als geschlossen dokumentiert (Redeploy `preview_page` + `save_preview`, Live-Contracts danach OK).

## Validierung
- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_verify_jwt_visibility.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run -s docs:lint`
- `bash scripts/check_edge_live_env_readiness.sh` (mit gesetzten Live-Variablen: OK)
- `bash scripts/check_edge_live_contracts.sh` (mit gesetzten Live-Variablen: OK)
- `bash scripts/check_release_readiness.sh` (`OK_FULL` mit gesetzten Live-Variablen)
