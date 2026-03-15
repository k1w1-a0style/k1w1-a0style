# Patch 444

Datum: 2026-03-15

## Ziel
Kleine, echte Konsistenzhärtung im Supabase-Edge-Flow `save_preview`: CORS-/Security-Header zwischen lokalen Erfolgs-/Fehlerantworten und den Auth-/Rate-Limit-Fehlerpfaden angleichen, ohne Preview-Logik oder Auth-Architektur umzubauen.

## Änderungen
- **`supabase/functions/save_preview/helpers.ts`**
  - Lokale `corsHeaders(origin)` auf `_shared/cors` umgestellt (`getCorsHeaders(origin)`).
  - Effekt: `save_preview`-Erfolg + lokale Fehler (`json(..., { headers: cors })`) nutzen jetzt denselben Header-Stack wie `requireAdminKey`/`rateLimit`-Fehler (`errorResponse` aus `_shared/cors`).
- **`__tests__/savePreview.corsConsistency.invariants.test.ts`**
  - Neuer Invariant-Test, dass `save_preview`-Header und `_shared/cors` für explizite Origins identisch sind.
  - Neuer Invariant-Test für identisches Fallback-Verhalten ohne Origin.
  - Neuer Invariant-Test, dass relevante Security-/Preflight-Header (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Access-Control-Max-Age`) erhalten bleiben.

## Verifikation
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Hinweis
Bewusst **kein** Broad-Refactor und keine neue Edge-/Auth-Architektur: nur der lokale Header-Drift in `save_preview` wurde auf die bestehende Shared-Quelle gezogen.
