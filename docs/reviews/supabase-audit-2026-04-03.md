# Supabase/Edge/Auth/RLS Audit — 2026-04-03

## Scope & Source of Truth
- In Reihenfolge gelesen:
  1. `docs/TESTING_GUIDE.md`
  2. `docs/04-testing-smoke-plan.md`
  3. `docs/EDGE_FUNCTIONS_STATUS.md`
  4. `scripts/check_release_readiness.sh`
  5. `scripts/check_edge_live_contracts.sh`
  6. `scripts/check_supabase_rls_hardening.sh`
  7. `docs/runbooks/SUPABASE_DEPLOY_AND_MIGRATIONS.md`
- Fokus: Supabase Edge Functions, Auth/RBAC, RLS, Live-Contracts, Deploy-/Migration-Hygiene.
- Keine mutierenden Aktionen (kein deploy/db push).

## Kurzfazit
- Der lokale Vertragsstand ist stark test-/script-gesichert und überwiegend fail-closed.
- Historischer Befund vom 2026-04-03: Allowlist/Ref-Regel waren damals als Risikopunkte dokumentiert.
- **Aktualisierung 2026-04-07 (Repo-Stand):**
  - `K1W1_ALLOWED_GITHUB_REPOS` ist fail-closed (leer => deny).
  - `K1W1_ALLOWED_REF_REGEX` ist fail-closed (leer => deny) und wird zentral über `_shared/github.ts:isAllowedGitRef(...)` geprüft.
- Live-Contract-Checks konnten ohne `EDGE_BASE_URL` + `EDGE_OPERATOR_JWT` nicht gegen echte Supabase-Live-Endpunkte verifiziert werden.

## Ausgeführter Prüfpfad
- `npm ci`
- `npm run typecheck`
- `npm run typecheck:edge`
- `npm run typecheck:strict`
- `npm run lint:ci`
- `npm run test:silent`
- `npm run test:e2e:smoke`
- `npm run verify:release`

Alle Kommandos liefen grün; `verify:release` hat Live-Contracts mangels Env sauber als SKIP markiert.

## Priorisierte Findings (Top 5)
1. **[HIGH] Repo-Allowlist default-open**
   - **Status 2026-04-07:** geschlossen; `isAllowedGithubRepo(...)` ist fail-closed.
2. **[HIGH] Ref-Regel default-open**
   - **Status 2026-04-07:** geschlossen; Ref-Validierung ist zentral fail-closed (`isAllowedGitRef(...)`).
3. **[MEDIUM] Live-Contract nicht praktisch verifiziert**
   - Die geforderten Live-Checks (`k1w1-handler` invalid JSON, `preview_page` bogus secret) sind nur scriptseitig belegbar, nicht gegen echtes Projekt ausgeführt.
4. **[MEDIUM] Historischer Preview-Secret-URL-Pfad (inzwischen entfernt)**
   - **Status 2026-04-07 (Patch 749):** Query-Secret-Compat in `preview_page` ist entfernt (kein `?secret=`-Pfad, keine Legacy-Bridge); Preview akzeptiert nur Fragment-Start + Header-Handoff (`x-k1w1-preview-secret`).
5. **[LOW-MEDIUM] upload-artifact SHA-Pins nicht einheitlich**
   - Mehrere unterschiedliche Pins (`ea165f...`, `4cec3d...`) im Repo; kein unmittelbarer Defekt, aber Drift-/Wartungsrisiko.

## Klassifizierung

### Echte Sicherheits-/Vertragsprobleme
- Nicht verifizierte Live-Contracts (nur lokal/script-theoretisch geprüft).

### Hygiene-/Wartungsthemen
- Uneinheitliche `actions/upload-artifact`-Pins über Workflows.
- Historischer Preview-Secret-URL-Restpunkt ist repo-seitig geschlossen; bleibt nur als Altbefund im Auditverlauf dokumentiert.

## Empfehlungen

### Sofort fixen
1. Einen CI-Job/Runbook-Schritt etablieren, der mit kurzlebigem `EDGE_OPERATOR_JWT` den Live-Contract-Check regelmäßig wirklich ausführt.

### Separat refactoren
1. Einheitlichen `upload-artifact`-Pin zentralisieren (Template-SoT + Drift-Check auf exakt einen Pin).
2. Preview-Link-Vertrag härten (z. B. TTL-verkürzte Token, optional one-time lookup, konsequente no-referrer Headers/Doku).

### Kann vorerst bleiben
1. Durable-Rate-Limit mit lokalem Fallback: ist bewusst umgesetzt und testlich abgesichert; als Verfügbarkeitskompromiss akzeptabel, solange Monitoring aktiv ist.
2. Public `preview_page` mit Secret-Link: akzeptabel, wenn Secret-Rotation/TTL kurz bleiben und Logs/Referrer-Risiken operational mitigiert sind.
