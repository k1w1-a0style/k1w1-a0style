# Patch 69

**Scope:** AppInfoScreen hardening (privacy + import correctness + perf + tests)

## Changes

- AppInfoScreen: **mask API keys by default** and add a **temporary reveal** button (auto-hide) per provider.
- Import API keys: treat import as **Replace**, not append/merge.
- Backup import: stricter validation + sanitization (shape checks, trimming, dedupe).
- Template section: memoize effective template resolution.
- Tests: add unit coverage for masking + backup validation/sanitization.

## Files touched

- `screens/AppInfoScreen/components/ActiveApiKeysSection.tsx`
- `screens/AppInfoScreen/components/TemplateInfoSection.tsx`
- `screens/AppInfoScreen/hooks/useAppInfoScreen.ts`
- `screens/AppInfoScreen/styles.ts`
- `lib/apiKeyMasking.ts`
- `lib/appInfoBackup.ts`
- `__tests__/appInfoBackupPrivacy.test.ts`
- `docs/reviews/APP_INFO_SCREEN_VERIFICATION.md`
- `docs/TODO.md`
- `PROJECT_CHECKLOG.md`

## Notes

- UI stays the same visually, except the API keys area now shows masked values + a small reveal toggle.