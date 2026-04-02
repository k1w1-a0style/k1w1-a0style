# Patch 686

## Titel
Contract / invariant test wave

## Zusammenfassung
- `patch570.typeContracts.invariants.test.ts` und `ciLitePatch.invariants.test.ts` lesen Repo-Quellen jetzt helper-first ueber `readRepoText(...)`.
- `supabaseErrorSanitization.test.ts` ersetzt `sanitizeUnknownForTransport(...) as any` durch Unknown-/Record-/Array-Reader.
- `savePreview.authCorsAndTypecheck.invariants.test.ts` ersetzt `globalThis.Deno as any` ueber einen kleinen Runtime-Helper und behebt den verwaisten letzten `it(...)`-Block.
- Kern-MDs stehen wieder auf demselben Patchstand wie README/TODO/Checklog.

## Geaenderte Dateien
- `__tests__/helpers/repoSourceHelpers.ts`
- `__tests__/patch570.typeContracts.invariants.test.ts`
- `__tests__/ciLitePatch.invariants.test.ts`
- `__tests__/supabaseErrorSanitization.test.ts`
- `__tests__/savePreview.authCorsAndTypecheck.invariants.test.ts`
- `README.md`
- `docs/TODO.md`
- `docs/INDEX.md`
- `docs/TESTING_GUIDE.md`
- `docs/FRESH_CHECKOUT_GREEN_PATH.md`
- `docs/04-risk-hotspots.md`
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_686.md`

## Validation
- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`

## Befund
Der produktive Runtime-/App-/Edge-/Helper-Code bleibt ausserhalb von Tests/Docs/Historie weiter frei von bestaetigten `any`-Resten.
