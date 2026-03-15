# Patch 450 — CustomHeader/CI-Lite Restfix (Race + Dispatch + Typing)

## Ziel
Konservative Restbehebung im CI-Lite-Header-Flow ohne Architekturumbau:
- stale Run/Log-State über Input-Wechsel vermeiden
- Persist-Race gegen Autofix/CI-Lite entkoppeln
- Doppel-Dispatch per Doppeltap blockieren
- flow-nahe Typing-/Patch-Sync-Reste schließen

## Änderungen

1. **`useGitHubActionsLogs` Input-Reset + Request-Guard**
   - State-Reset bei Wechsel von `githubRepo`/`runId`/`workflowId`.
   - Request-Key-Guard verhindert, dass verspätete Antworten in neuen Input-Kontext schreiben.

2. **CI-Lite Persist-Race Guard in `useCiLiteWorkflow`**
   - Persistenz läuft nur noch, wenn `workflowRun.id === runId` und Workflow wirklich `k1w1-ci-lite.yml` ist.
   - Zusätzlich Repo/Branch-Kontext-Guard (`targetRef` muss aktueller Branch sein).

3. **Dispatch-Guard gegen Doppeltap**
   - Früher Return bei aktivem Dispatch (`if (dispatching) return;`).

4. **Typing-/Parsing-Härtung**
   - `WorkflowRun` um `head_sha` ergänzt.
   - Artifact-JSON-Lesen lokal typisiert (`parseCiLiteArtifactJson`) statt ungezielter `as any`-Extraktion.

5. **Patch-Sync-Reste in `useCiLitePatch`**
   - `syncPatchToGitHub` auf `useCallback` stabilisiert.
   - `pushFilesToRepo(... as any)` entfernt, stattdessen `ProjectFile[]`.
   - `markRepoSyncSignature`-Payload ohne `as any`.

6. **Chain-Run-Kopplung dokumentarisch abgesichert**
   - Branch-basierte Kopplung bleibt bewusst, dafür durch Invariants explizit regressionsgesichert.

## Tests
- `__tests__/useGitHubActionsLogs.contract.test.tsx` erweitert (State reset bei Repo/Run-Wechsel)
- `__tests__/ciLiteHeaderWorkflow.invariants.test.ts` neu
- `__tests__/ciLitePatch.invariants.test.ts` neu
- `__tests__/ciLiteArtifactParsing.test.ts` neu

## Verifikation
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
