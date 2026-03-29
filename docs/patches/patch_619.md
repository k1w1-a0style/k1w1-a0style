# Patch 619 — Strukturierter `as any`-Audit mit Risiko-Priorisierung und gezieltem Minimal-Abbau

## Ziel
Repo-weites `as any`-Inventar mit ehrlicher Risikoklassifikation (A/B/C/D) und **nur** kleinem, sicheren Abbau der gefaehrlichsten Runtime-Stellen.

## Inventar (Ist-Stand vor Abbau)
- Suche: `rg -n "as any" --glob '!node_modules'`
- Treffer gesamt: **260**
- Grobklassifikation:
  - **A Runtime/Domain/Validation/Config/Networking/Normalizer:** 61
  - **B UI/State/Component-Glue:** 29
  - **C Tests/Mocks/Fixtures:** 163
  - **D/E Styles/Theming/Interop/Tooling:** 7+

## In Patch 619 abgebaut (gezielt, klein, risikoorientiert)
1. `config.ts`
   - Entfernt unnötigen Env-Cast in `MAX_FILES`-Ableitung.
2. `lib/validators.ts`
   - Entfernt `CONFIG as any`-Kette in Root-/Folder-/Ext-/Path-Length-/Validation-Reads.
3. `lib/supabase.ts`
   - Ersetzt `process as any` durch kleinen getypten Runtime-Env-Adapter.
4. `lib/supabaseEdge.ts`
   - Ersetzt Env-Lookup via `process as any` durch `getRuntimeEnv()`.
5. `lib/normalizer.ts`
   - Entfernt mehrere `raw/parsed as any`-Zugriffe durch `asRecord`/`getRecordString`-Guards.
6. `lib/diagnostics/buildPipelineDiagnostics.ts`
   - Ersetzt `readJsonFile<any>` und Canonical-EAS-Profile-Cast durch enge Typen (`EasConfig`, `EasProfileName`).
7. `project/services/projectArchiveService.ts`
   - Entfernt `res:any`, `project as any` und setzt typed Import/Export-/chatHistory-Zugriff.
8. `screens/ConnectionsScreen/utils/validation.ts`
   - Ersetzt `value as any` in Fehlertext-Pfad durch Unknown-Guard.

## Bewusst offen gelassen (priorisiert)
- **A/B offen:**
  - `lib/diagnostics/ciAutoFix.ts` (`error as any`)
  - `supabase/functions/*` (`k1w1-handler`, `github-workflow-logs`, `create_codesandbox`, `android-keystore-generate/helpers.ts`)
- **C/D/E offen (niedrig priorisiert):**
  - UI-/Icon-/Theme-Interop-Casts
  - Test-/Mock-/Fixture-Casts
  - Tooling-/Shell-Template-Reste

## Warum kein Mega-Refactor
- Ziel war risikogesteuerter, minimal-invasiver Abbau.
- Kein blinder globaler Replace.
- Keine Contract-/Auth-/Workflow-Umbauten.
- Keine Hook-Refactor-Vermischung.

## Verifikation
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
