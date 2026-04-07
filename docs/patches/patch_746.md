# Patch 746 — Persistenz-Recovery Guards + Secret/Preview/Edge-Defaults

## Ziel

Pflicht-Follow-up aus PR-572 robust schliessen:
- NoRekeyOnRead
- NoDelayedOverwrite
- CorruptPlaintextHandling
- EmptyEasProjectIdWrite
- PreviewLegacyFollowup
- DisabledEdgesFlagFollowup

## Umsetzung

1. `infra/storage/projectStorageCrypto.ts`
   - Read/Decrypt nutzt jetzt nur noch vorhandene SecureStore-Keys.
   - Kein stilles Key-Neuanlegen im Decrypt-Pfad.
2. `infra/storage/projectPersistence.ts`
   - kaputte verschluesselte **und** kaputte unverschluesselte Payloads liefern explizite Recovery-Fehler statt `null`.
3. `contexts/ProjectContext.tsx` + `contexts/projectContextPersistenceHelpers.ts`
   - Recovery-Mode blockiert normale Debounce-/Background-Saves (NoDelayedOverwrite).
   - Explizite Ersatzaktionen (`replaceProjectData`) entsperren bewusst und speichern dann gezielt.
4. `screens/AppInfoScreen/hooks/useAppInfoScreen.ts`
   - EAS Project ID Import guard via `resolveEasProjectIdImportDecision(...)`.
5. `supabase/functions/preview_page/index.ts`
   - Preview-Token-Format-Validation, Legacy-Query-Bridge bleibt minimiert erhalten.
6. `supabase/config.toml`
   - deaktivierte Legacy-Functions auf fail-safe `verify_jwt = true` vereinheitlicht.

## Tests / Checks

- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent -- --runInBand __tests__/projectPersistence.encryption.test.ts __tests__/projectContext.persistenceHelpers.test.ts __tests__/easProjectIdImportHelpers.test.ts __tests__/previewEdgeErrorContract.test.ts __tests__/appInfoSecretImportStatusReset.test.ts`
- `npm run -s test:silent -- --runInBand __tests__/disabledEdgeVerifyJwtDefaults.invariants.test.ts`

## Nicht-Ziele

- kein breiter Architekturumbau
- keine Entfernung des Legacy-Preview-Bridge-Pfads ohne Migrationsfenster
