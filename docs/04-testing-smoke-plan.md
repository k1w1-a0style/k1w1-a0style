# 04 — Testing & Smoke Plan

Stand: **2026-04-02 (Docs Konsolidierung)**

Dieses Dokument beschreibt den **aktuellen manuellen Smoke-Plan**. Es ist bewusst kompakt und verweist fuer Detail-Checks auf die Test-/Runbook-Doku.

## Ziel

Schnell bestaetigen, dass der wichtigste Operator-Flow weiterhin stimmt:

1. Repo/Branch setzen
2. Connections/Tokens vorhanden
3. Diagnostics / Build-Readiness korrekt fail-closed
4. Build-Dispatch / Status / Logs / History konsistent
5. aktive Edge-Vertraege und Doku-Contracts nicht wegdriften

## Manueller Smoke-Plan

### A. Lokale Baseline

```bash
npm ci
npm run typecheck
npm run lint:ci
npm run test:silent
```

### B. Repo-/Build-Readiness

- Repo/Branch setzen
- Diagnostics laufen lassen
- Build darf ohne gruenes Gate **nicht** starten
- Build-Blocked-Reason muss sichtbar und nachvollziehbar sein

### C. Preview / AI / Edge

- `save_preview` arbeitet mit verifiziertem JWT
- `preview_page` liefert kontrollierte HTML-/Fehlerantworten
- `k1w1-handler` bleibt JWT-/Claim-gebunden und antwortet bei absichtlich kaputtem JSON sauber fail-closed

### D. Release-/Operator-Verify

```bash
npm run verify:release
```

Optional mit read-only Live-Edge-Checks:

```bash
EDGE_BASE_URL="https://<project>.supabase.co/functions/v1" EDGE_OPERATOR_JWT="<extern provisionierter build_admin jwt>" npm run verify:release
```

## Verweise

- `docs/TESTING_GUIDE.md`
- `docs/FRESH_CHECKOUT_GREEN_PATH.md`
- `docs/08-test-coverage-matrix.md`
- `docs/runbooks/APP_RUNBOOK.md`
