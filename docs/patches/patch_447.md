# Patch 447

Datum: 2026-03-15

## Ziel
Letzten kleinen Edge-/Deno-Typing-Rest in shared Runtime-/Validation-Helfern konservativ nachschärfen, um flow-nahe Request-Validierung ehrlicher zu machen — ohne Broad-Refactor.

## Änderungen
- **`supabase/functions/_shared/auth.ts`**
  - `globalThis as any` beim Runtime-Env-Lookup durch lokales `RuntimeGlobals`-Typing ersetzt (`Deno.env` / `process.env`).
  - Laufzeitverhalten bleibt identisch (Deno zuerst, Node/Jest fallback), aber ohne untypisierte Globalzugriffe.

- **`supabase/functions/_shared/cors.ts`**
  - Gleiches, minimales Runtime-Global-Typing wie in `auth.ts`, damit Edge-/Node-Kontext sauber und ohne `any` gelesen wird.

- **`supabase/functions/_shared/validation.ts`**
  - `Err.errors` auf `Record`-basierten Validation-Shape gehärtet statt `any`.
  - `parseJsonBody` gibt nur noch Objekt-Body (`Record<string, unknown>`) als `ok` zurück; nicht-Objekt-JSON wird explizit abgewiesen.
  - `validateTriggerBuildRequest` nutzt `isBuildProfile`-Type-Guard statt `buildProfile as any`.
  - `validateGithubWorkflowDispatchRequest` typisiert `inputs` über lokales `asStringRecord`-Narrowing statt `inputs as any`.

- **`__tests__/edgeFunctionContracts.test.ts`**
  - Neue Regression für `parseJsonBody`: JSON-Array wird sauber als ungültiger Request-Body erkannt.

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
Bewusst kein Vollumbau: nur bestätigte, flow-nahe `_shared`-Typing-Restpunkte (Runtime-Env + Request-Validierung) wurden minimal eingegrenzt; viele nicht-kritische `any`-Stellen außerhalb dieser Pfade bleiben als selektive Follow-ups offen.
