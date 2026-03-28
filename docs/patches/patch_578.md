# Patch 578 - GitHubReposScreen: Notice-/Success-Mapping als kleiner Pure-Helper

## Ziel
Den naechsten kleinen Mischblock in `useGitHubReposScreen.ts` entlasten, ohne Hook-Flow umzubauen: pure Result-/Notice-/Success-Text-Mappings fuer userkritische Hinweise.

## Umsetzung
- Neuer lokaler pure Helper `screens/GitHubReposScreen/hooks/githubReposScreenNoticeHelpers.ts`:
  - `getSecretsSyncNotice(updatedSecrets)` kapselt das Secrets-Sync-Result-Mapping (`keine Updates` vs. `synchronisiert`).
  - `getEasLinkWriteNotice(writeOutcome)` kapselt das EAS-Write-Outcome-Mapping (`verified` / `pending_recheck` / Rest als Warnung).
- `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts` nutzt die Helper jetzt in:
  - `handleSyncSecrets` (Notice-Titel/-Text nicht mehr inline),
  - `handleEasLink` (Result-/Success-/Warn-Alert-Mapping nicht mehr inline).
- Hook bleibt Orchestrator fuer Async-/Busy-/Dialog-Flow; es wurde kein API- oder Ablauf-Umbau vorgenommen.

## Verhaltensvertrag
- Kein beabsichtigter Verhaltenswechsel bei:
  - Secrets-Sync-Erfolg/Leerfall-Notice,
  - EAS-Link-Write-Alerts fuer `verified`, `pending_recheck` und nicht-verifizierte Recheck-Ergebnisse.
- Nur der Ort der Textbildung wurde entkoppelt (inline -> pure Helper).

## Tests / Checks
- Neue fokussierte Regression: `__tests__/githubReposScreen.noticeHelpers.test.ts`.
- Ausgefuehrte Checks:
  - `npm run typecheck`
  - `npm run lint:ci`
  - `npm run test:silent -- --runInBand __tests__/githubReposScreen.noticeHelpers.test.ts __tests__/githubReposScreen.pullPushSemantics.test.ts __tests__/githubReposScreen.easLinkStatusRace.test.tsx`
  - `git diff --check`
  - `bash scripts/check_patch_docs_sync.sh`
