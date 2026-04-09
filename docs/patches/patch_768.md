# Patch 768 — ResidualHotspotFinalScan + WeakFallbackHygiene

## Kontext
Nach den grossen Hotspot-Wellen blieb ein Restblock aus A1/A2/A3 mit zwei Aufgaben:
1. verbliebene Residual-Hotspots erneut eng und regressionssensibel pruefen,
2. verbleibende produktnahe Weak-Fallbacks im selben Scope direkt mitziehen.

## Umsetzung
1. **Residual-Hotspot-Finalscan (A1/A2/A3)**
   - Die verbleibenden Haupt-Hotspot-Dateien wurden erneut auf ueberladene Restverantwortung geprueft.
   - Ergebnis: kein weiterer risikofreier Mehrwert-Split erzwungen; verbleibende groessere Dateien sind aktuell fachlich sinnvolle Orchestratoren.

2. **WeakFallbackHygiene (direkter Scope-Fund)**
   - `screens/GitHubReposScreen/hooks/useGitHubReposScreenBootstrap.ts`:
     - ersetzt stilles `AsyncStorage.getItem(...).catch(() => "")`
     - durch explizites `try/catch` mit `null`-Sentinel + `logger.warn(...)`
   - Verhalten bleibt gleich fail-safe (`easProjectId` wird weiterhin leer gesetzt, wenn kein Wert gelesen werden kann), aber Fehlerpfad ist sichtbar statt stumm.

3. **SoT-/Patch-Sync**
   - Patch-/Stand-Header auf Patch 768 synchronisiert (`README`, `TODO`, `Review`, `INDEX`, `TESTING_GUIDE`, `FRESH_CHECKOUT`, `EDGE_FUNCTIONS_STATUS`).
   - Checklog/Patchlog auf denselben Patchstand gezogen.

## Validierung
- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_verify_jwt_visibility.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run -s docs:lint`
- `bash scripts/check_release_readiness.sh`
- `bash scripts/check_edge_live_env_readiness.sh` (env-abhaengig)
- `bash scripts/check_edge_live_contracts.sh` (env-abhaengig)
