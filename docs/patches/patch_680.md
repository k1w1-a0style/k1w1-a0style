# Patch 680 — Refactor-Durchlauf 40 (preflight/security/patch contract test cleanup)

## Ziel
Den naechsten helper-first Test-Contract-Block ohne Produktcode-Umbau nachziehen.

## Umgesetzt
- `lib/__tests__/fixSafety.test.ts` nutzt jetzt `makePreflightPatch(...)` statt lokaler `as any`-Patch-Casts.
- `__tests__/patchFingerprint.test.ts` nutzt helper-first getypte `PreflightPatch`-Fixtures.
- `__tests__/preflight.entryPointAutofix.test.ts`, `preflight.securityForbiddenFiles.test.ts`, `preflight.easWithoutCredentialsDebugPatch.test.ts`, `preflight.workflowServiceRoleSafeAssist.test.ts` und `preflight.workflowNameColonQuoting.test.ts` nutzen jetzt getypte `ProjectFile`-/Patch-Helper statt lokaler `as any`-Datei-/Patch-Pfade.
- `__tests__/helpers/preflightTestHelpers.ts` wurde um `makeProjectFile(...)` und `makePreflightJsonMergePatch(...)` erweitert.

## Ergebnis
- Produktcode bleibt unberuehrt.
- Der naechste zusammenhaengende Test-/Contract-Cluster ist helper-first beruhigt.

## Validation
- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`
