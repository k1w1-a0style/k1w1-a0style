# PATCH 70 NOTES

## Summary

Hotfix for **AppInfoScreen backup/import** after patch 69:

- Fix TypeScript/typecheck errors by aligning backup sanitization with the real `AIConfig` shape.
- Harden backup JSON validation (invalid `apiKeys` shapes now fail fast).
- Keep backward compatibility: legacy `selectedAutofixProvider` is mapped to `selectedAgentProvider`.

## UI impact

None.

## Files changed

- `lib/appInfoBackup.ts`
- `__tests__/appInfoBackupPrivacy.test.ts`
- `docs/reviews/APP_INFO_SCREEN_VERIFICATION.md`
- `docs/patches/PATCH_70_NOTES.md`
- `docs/TODO.md`
- `PROJECT_CHECKLOG.md`
