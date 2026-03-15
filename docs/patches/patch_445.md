# Patch 445

Datum: 2026-03-15

## Ziel
Den verbleibenden kleinen Restpunkt rund um `save_preview`-Response-Konsistenz weiter absichern und den offenen Typecheck-Restpunkt (Deno-/Node-Env-Lookup in `_shared/auth`) minimal beheben.

## Änderungen
- **`supabase/functions/_shared/auth.ts`**
  - Harte `Deno.env.get(...)`-Zugriffe durch einen runtime-kompatiblen Env-Helper ersetzt (`Deno` falls vorhanden, sonst `process.env`).
  - Secret-Lookups in `hasAdminKeySecretConfigured`, `hasServiceRoleSecretConfigured`, `getServiceRoleKey`, `requireAdminKey`, `requireServiceRoleBearer` auf diese zentrale Lookup-Logik vereinheitlicht.
  - Ergebnis: gleiches Laufzeitverhalten in Edge, aber stabilerer Node/Jest/Typecheck-Kontext ohne direkte Deno-Abhängigkeit.
- **`__tests__/savePreview.authCorsAndTypecheck.invariants.test.ts`**
  - Neuer Invariant-Test: Auth-Fehlerpfad (`requireAdminKey`) liefert für gleiche Origin kompatible CORS/Security-Header wie `save_preview`.
  - Neuer Invariant-Test: Rate-Limit-Fehlerpfad (`rateLimit`) liefert kompatible Header wie `save_preview`.
  - Neuer Invariant-Test: Auth-Guard funktioniert auch ohne `globalThis.Deno` mit `process.env` (Node-Fallback).

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
Bewusst kein Architekturumbau: nur kleine Konsistenz- und Typing-Härtung im bestehenden Helper-/Guard-Setup.
