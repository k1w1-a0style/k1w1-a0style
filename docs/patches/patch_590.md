# Patch 590

Datum: 2026-03-28

## Ziel

Restliche stille Branch-/Ref-Fallbacks (`"main"`) in tieferen Shared-/Infra-Layern entfernen und branch-sensitive Helper fail-closed machen.

## Umsetzung

1. **`infra/github/workflows.ts`**
   - `triggerWorkflow(...)` nutzt keinen `ref = "main"`-Default mehr.
   - Fehlender/leer getrimmter Ref wird jetzt sofort mit `Explicit branch/ref is required.` abgewiesen.

2. **`infra/github/files.ts`**
   - `resolveTargetBranch(...)` entfernt den stillen `"main"`-Fallback und wirft bei leerem Zielbranch fail-closed.
   - `createOrUpdateFile(...)` / `deleteRepoFile(...)` haben keinen impliziten `branch = "main"`-Default mehr und verlangen expliziten Branch.
   - `listRepoBlobEntries(...)` nutzt bei fehlendem `ref` nur noch echte Repo-Metadaten (`getDefaultBranch`) und rät nicht mehr auf `"main"`.

3. **`infra/github/branchOps.ts`**
   - `getDefaultBranch(...)` entfernt `json.default_branch || "main"`.
   - Fehlendes/leeres `default_branch` liefert jetzt den stabilen Fehler `Repository default_branch is missing.`.

4. **`supabase/functions/android-keystore-generate/index.ts`**
   - Entfernt `safeString(body?.branch) || "main"`.
   - Kein impliziter Branch-Guess mehr in dieser Route.

5. **Checks / Tests / Docs**
   - Vertrags-Checks in `scripts/check_workflow_edge_contracts.sh` auf die neuen fail-closed Regeln erweitert.
   - Fokus-Tests ergänzt/aktualisiert:
     - `__tests__/githubBranchRefHardening.contracts.test.ts`
     - `__tests__/githubFiles.contracts.test.ts`
   - Doku synchronisiert (`README.md`, `PROJECT_CHECKLOG.md`, `docs/04-risk-hotspots.md`, `docs/06-build-readiness.md`, `docs/EDGE_FUNCTIONS_STATUS.md`, `docs/patches/PATCHLOG_ROOT.md`).

## Verifikation

- `npm run test:silent -- --runInBand __tests__/githubFiles.contracts.test.ts __tests__/githubBranchRefHardening.contracts.test.ts`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
