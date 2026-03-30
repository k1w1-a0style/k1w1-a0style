# Patch 629 — `as any`-Abbau (Durchlauf 3, kleiner UI-/Glue-Scope)

## Ziel
Dritter Durchlauf mit kleinen, lokal sicheren `as any`-Abbauten in UI-/Glue-nahen Stellen, ohne Hook-/Architektur-Umbau.

## Umgesetzt
1. `polyfills.ts`
   - `globalThis as any` und `noop as any` entfernt.
   - Kleiner `PolyfillGlobal`-Typ + typisierte console-Noop-Zuweisung.

2. New-Architecture Flags ohne `global as any`
   - `screens/CredentialsWizardScreen/index.tsx`
   - `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts`

3. `screens/EnhancedBuildScreen/components/WorkflowRunDetailModal.tsx`
   - `run as any` fuer `display_title`/`event` durch lokal getypte `runRecord`-Sicht ersetzt.

4. `screens/SettingsScreen/components/ApiKeysSection.tsx`
   - `(PROVIDER_METADATA as any)?.[p]` entfernt; direkter typisierter Zugriff.

5. `screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx`
   - `(f as any).content`-Zugriffe im local/localMap-Pfad entfernt.

## Inventar
- Codefokussierter Scan (ohne `docs/**` und `README.md`):
  - Vorher: 208
  - Nachher: 197
  - Netto: **-11 `as any`**

## Verifikation
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `npm run test:silent -- --runInBand k1w1Handler.providers.invariants.test.ts`
- `git diff --check`
