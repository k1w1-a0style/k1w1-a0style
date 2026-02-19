# Patch 208: Docs refresh (handoff + TODO)

## Why
Nach den Cleanup-Patches (205–207) und dem Preview-Refactor sind `docs/PROJECT_TODO.md` und `docs/HANDOFF_NEXT_CHAT.md` teilweise veraltet (z.B. „logger hat 0 imports“, SettingsScreen keyMasking ist schon gelöscht, CrashRecovery ist schon im PreviewScreen-Hook drin).

## Changes
- Update `docs/HANDOFF_NEXT_CHAT.md`
  - Letzten Stand auf Patch 207 gehoben
  - Entfernte/erledigte Punkte aktualisiert (Shims/UI-Sektionen)
  - Offene Punkte neu priorisiert (contexts/types shim removal, optional console→logger)
- Update `docs/PROJECT_TODO.md`
  - Remove/adjust stale bullets
  - Mark `useWebViewCrashRecovery` in PreviewScreen as done
  - Clarify that SettingsScreen keyMasking file is gone; keep `lib/apiKeyMasking.ts` as canonical
- Update `docs/patches/PATCHLOG_ROOT.md` and `PROJECT_CHECKLOG.md`

## Verification
- No runtime code changes.
- Should keep: `npm run typecheck`, `npm run lint:ci`, `npm run test:silent` green.
