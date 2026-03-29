# Patch 589 — trigger-eas-build branch validation fail-closed (Edge-Eingang)

## Ziel
Den Edge-Request-Vertrag von `trigger-eas-build` serverseitig haerten: `branch` ist jetzt verpflichtend, leer/missing/Whitespace wird nicht mehr still toleriert.

## Umsetzung

1. **Trigger-Request-Validierung fail-closed**
   - Datei: `supabase/functions/_shared/validation.ts`
   - `validateTriggerBuildRequest(...)` verlangt jetzt fuer `trigger-eas-build` explizit einen nicht-leeren Branch.
   - Fehlend, leer oder nur Whitespace liefert jetzt `errors.branch = "branch must be a non-empty branch name"`.
   - Rueckgabevertrag ist fuer diesen Request auf `branch: string` gehaertet (nicht mehr optional).

2. **Ref-Allowlist fail-closed fuer leere Werte**
   - Datei: `supabase/functions/trigger-eas-build/index.ts`
   - Lokales `isAllowedRef(...)`: leere/missing Refs sind jetzt ungueltig (`false` statt frueher tolerantem `true`).

3. **Route-Vertrag trigger-eas-build auf Pflicht-Branch ausgerichtet**
   - Datei: `supabase/functions/trigger-eas-build/index.ts`
   - Contract-Kommentar auf `branch` (pflichtig) aktualisiert.
   - Kein `branch ?? null` mehr im Route-Eingang, Build-Job-Insert, Dispatch-Payload oder Success-Response.

4. **Contracts/Checks/Tests nachgezogen**
   - `__tests__/edgeFunctionContracts.test.ts` deckt jetzt explizit ab:
     - missing branch -> Validation fail
     - empty branch -> Validation fail
     - whitespace branch -> Validation fail
     - gueltiger Branch bleibt erlaubt und wird getrimmt
   - `scripts/check_workflow_edge_contracts.sh` erwartet den gehaerteten Trigger-Branch-Vertrag (`ref: branch`, `if (!isAllowedRef(branch))`).

## Abgrenzung (bewusst nicht Teil von Patch 589)
- Keine Entfernung tieferliegender Default-Branch-/`main`-Fallbacks in Shared/Infra-Layern.
- Keine State-/Context-Refactors.
- Keine Keystore-Secret-/RBAC-Umbauten.

## Geaenderte Dateien
- `supabase/functions/_shared/validation.ts`
- `supabase/functions/trigger-eas-build/index.ts`
- `__tests__/edgeFunctionContracts.test.ts`
- `scripts/check_workflow_edge_contracts.sh`
- `docs/06-build-readiness.md`
- `docs/EDGE_FUNCTIONS_STATUS.md`
- `docs/04-risk-hotspots.md`
- `docs/SYSTEM_README.md`
- `README.md`
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_589.md`

## Verifikation
- `npm run test:silent -- --runInBand __tests__/edgeFunctionContracts.test.ts`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
