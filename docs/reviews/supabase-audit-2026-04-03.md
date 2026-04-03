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
- Zwei bewusst offene Risikopunkte bleiben relevant:
  - `K1W1_ALLOWED_GITHUB_REPOS` ist bei leerer Allowlist default-open.
  - `K1W1_ALLOWED_REF_REGEX` ist bei leerem Regex default-open (rollout mode).
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
   - `isAllowedGithubRepo(...)` lässt alle Repos zu, wenn `K1W1_ALLOWED_GITHUB_REPOS` leer ist.
2. **[HIGH] Ref-Regel default-open**
   - `isAllowedRef(...)` erlaubt alle nicht-leeren/format-validen Refs, wenn `K1W1_ALLOWED_REF_REGEX` leer ist.
3. **[MEDIUM] Live-Contract nicht praktisch verifiziert**
   - Die geforderten Live-Checks (`k1w1-handler` invalid JSON, `preview_page` bogus secret) sind nur scriptseitig belegbar, nicht gegen echtes Projekt ausgeführt.
4. **[MEDIUM] Preview-Secret weiterhin Query-Param**
   - `save_preview` generiert `preview_page?secret=...`; das ist bewusstes Design, aber URL-Leak-Risiko bleibt operativ relevant.
5. **[LOW-MEDIUM] upload-artifact SHA-Pins nicht einheitlich**
   - Mehrere unterschiedliche Pins (`ea165f...`, `4cec3d...`) im Repo; kein unmittelbarer Defekt, aber Drift-/Wartungsrisiko.

## Klassifizierung

### Echte Sicherheits-/Vertragsprobleme
- Default-open bei `K1W1_ALLOWED_GITHUB_REPOS`.
- Default-open bei `K1W1_ALLOWED_REF_REGEX`.
- Nicht verifizierte Live-Contracts (nur lokal/script-theoretisch geprüft).

### Hygiene-/Wartungsthemen
- Uneinheitliche `actions/upload-artifact`-Pins über Workflows.
- Preview-Secret-in-URL als bekannter, operativ zu kontrollierender Restpunkt.

## Empfehlungen

### Sofort fixen
1. `K1W1_ALLOWED_GITHUB_REPOS` fail-closed machen (leer => deny).
2. `K1W1_ALLOWED_REF_REGEX` fail-closed machen (leer => deny oder enges Default-Pattern).
3. Einen CI-Job/Runbook-Schritt etablieren, der mit kurzlebigem `EDGE_OPERATOR_JWT` den Live-Contract-Check regelmäßig wirklich ausführt.

### Separat refactoren
1. Einheitlichen `upload-artifact`-Pin zentralisieren (Template-SoT + Drift-Check auf exakt einen Pin).
2. Preview-Link-Vertrag härten (z. B. TTL-verkürzte Token, optional one-time lookup, konsequente no-referrer Headers/Doku).

### Kann vorerst bleiben
1. Durable-Rate-Limit mit lokalem Fallback: ist bewusst umgesetzt und testlich abgesichert; als Verfügbarkeitskompromiss akzeptabel, solange Monitoring aktiv ist.
2. Public `preview_page` mit Secret-Link: akzeptabel, wenn Secret-Rotation/TTL kurz bleiben und Logs/Referrer-Risiken operational mitigiert sind.
