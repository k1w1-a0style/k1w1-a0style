# Patch 588 — Keystore-Auth-Scope fuer Generate/Status auf Export-Linie gehaertet

## Kontext

Nach Patch 586 (fail-closed JWT-RBAC `service_role|build_admin` fuer privilegierte Operator-Routen) und Patch 587 (Secret-Splitting) liefen `android-keystore-generate` und `android-keystore-status` weiterhin ueber den generischen `requireAdminKey(...)`-Pfad (`K1W1_EDGE_ADMIN_KEY`/`SIGNING_ADMIN_KEY`).

Ziel dieses Schritts: **nur** den Auth-/Secret-Scope fuer diese zwei Keystore-Routen auf den dedizierten Keystore-Scoped-Ansatz ziehen, analog zur bereits gehaerteten Referenzroute `android-keystore-export`.

## Umsetzung

1. `android-keystore-generate` auth-seitig umgestellt:
   - `requireAdminKey(req)` entfernt.
   - `requireScopedEdgeAuth(req, { scope: "android-keystore-generate", allowAdmin: true, allowCiBearer: false, allowJwtAuthHeaderWithAdmin: true, adminSecretEnv: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY" })` als Primaergate gesetzt.
   - Danach fail-closed JWT-RBAC via `requirePrivilegedOperatorJwtRole(req, "android-keystore-generate")` mit erlaubten Rollen `service_role|build_admin`.

2. `android-keystore-status` analog umgestellt:
   - Kein generischer `requireAdminKey(req)`-Pfad mehr.
   - Scoped Auth + dediziertes Keystore-Secret + derselbe JWT-RBAC-Vertrag (`service_role|build_admin`).

3. Shared Auth semantisch neutral erweitert:
   - Neuer Helper `PRIVILEGED_OPERATOR_ALLOWED_ROLES` + `requirePrivilegedOperatorJwtRole(...)` in `_shared/auth.ts`.
   - Bestehender Workflow-Helper (`requireWorkflowOperatorJwtRole`) bleibt unveraendert fuer die Workflow-Familie bestehen.

4. `supabase/config.toml` gezielt angeglichen:
   - `verify_jwt=true` fuer `functions.android-keystore-generate` und `functions.android-keystore-status` gesetzt.
   - Keine weiteren Funktionsblöcke veraendert.

5. Contract-/Invariant-/Script-Drift nachgezogen:
   - `__tests__/patch415.edgeAuthGuards.invariants.test.ts`
   - `__tests__/patch510.keystoreSharedSecretHelpers.invariants.test.ts`
   - `scripts/check_workflow_edge_contracts.sh`
   - `scripts/check_edge_helper_visibility.sh`

## Nicht-Ziele (bewusst unveraendert)

- Keine Branch-Pflichtverschaerfung.
- Keine Entfernung von `main`-Fallbacks.
- Keine Keystore-Branch-/Storage-/DB-Semantik-Refactors.
- Keine linked/active-State-Bereinigung.
- `android-keystore-export` funktional unveraendert (bleibt Referenzroute).

## Verifikation

- `npm run test:silent -- --runInBand __tests__/patch415.edgeAuthGuards.invariants.test.ts __tests__/patch510.keystoreSharedSecretHelpers.invariants.test.ts`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_edge_helper_visibility.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
