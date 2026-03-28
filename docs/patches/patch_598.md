# Patch 598 — Legacy Guard Surface Reduction (SIGNING_ADMIN_KEY entkoppelt)

## Ziel
Den verbleibenden generischen `requireAdminKey(...)`-Angriffs-/Driftbereich verkleinern:

1. `SIGNING_ADMIN_KEY` aus dem generischen Guard entfernen.
2. Legacy-Routen auf explizite scoped Guard-Vertraege ziehen.
3. Caller-/Contract-/Docs-/Check-Sync sicherstellen.

## Umsetzung

1. **Shared Auth (`_shared/auth.ts`)**
   - `requireAdminKey(...)` akzeptiert nur noch `K1W1_EDGE_ADMIN_KEY`.
   - Kein stiller Fallback auf `SIGNING_ADMIN_KEY` mehr.
   - Neuer dedizierter Helper `requireSigningAdminKey(...)` fuer signing-spezifische Pfade.

2. **Legacy-Routen explizit scoped gemacht**
   - `k1w1-handler` -> `requireScopedEdgeAuth(... adminSecretEnv: "K1W1_EDGE_ADMIN_KEY", allowCiBearer: false)`
   - `create_codesandbox` -> gleicher scoped Vertrag
   - `save_preview` -> gleicher scoped Vertrag
   - disabled lint/native-sync Stubs -> gleicher scoped Vertrag (bleiben weiterhin 410 + disabled)

3. **Tests/Invariants/Checks nachgezogen**
   - `__tests__/savePreview.authCorsAndTypecheck.invariants.test.ts`
     - nutzt scoped Guard
     - neuer Nachweis: `SIGNING_ADMIN_KEY` ist kein generischer Fallback mehr
   - `__tests__/patch415.edgeAuthGuards.invariants.test.ts`
     - legacy generic routes auf scoped `K1W1_EDGE_ADMIN_KEY`
   - `__tests__/patch416.legacyEdgeDisablement.invariants.test.ts`
     - disabled routes enthalten scoped Guard-Vertrag
   - `__tests__/patch514.buildPreviewEnvSharedHelpers.invariants.test.ts`
     - `save_preview` erwartet scoped Guard statt `requireAdminKey(req)`
   - Skripte:
     - `scripts/check_edge_helper_visibility.sh`
     - `scripts/check_legacy_disabled_edges.sh`
     - `scripts/check_workflow_edge_contracts.sh`

4. **Dokumentation aktualisiert**
   - `docs/EDGE_FUNCTIONS_STATUS.md`
   - `docs/04-risk-hotspots.md`
   - `docs/06-build-readiness.md`
   - `README.md`
   - `PROJECT_CHECKLOG.md`
   - `docs/patches/PATCHLOG_ROOT.md`

## Ergebnis

- `SIGNING_ADMIN_KEY` ist nicht mehr Teil des generischen Admin-Key-Vertrags.
- Verbleibende Legacy-Routen sind explizit auf `K1W1_EDGE_ADMIN_KEY` scoped.
- Disabled Legacy-Routen bleiben sichtbar deaktiviert (410), aber ohne irrefuehrenden Allzweck-Guard.
- Tests/Checks/Doku sind auf den neuen Vertrag synchronisiert.

## Verifikation (lokal)

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/check_edge_helper_visibility.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_patch_docs_sync.sh`
