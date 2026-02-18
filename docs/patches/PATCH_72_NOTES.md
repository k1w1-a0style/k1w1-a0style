# Patch 72 Notes

## Goal
Hotfix for `CredentialsWizardScreen` after Patch 71:
- Fix TypeScript errors (missing React hook import, debug type mismatch).
- Make privacy sanitizers behave as expected (redaction + truncation marker).

## What changed
- **Type fix**: `WizardHttpDebug` now supports `method?: string`.
- **Hook fix**: `useCredentialsWizardScreen` imports `useCallback`.
- **Sanitizer hardening**:
  - Redacts quoted assignments like `apiKey="..."` (and similar key/value cases).
  - Adds a consistent `<truncated>` marker when the original text exceeded the size cap, even if redaction would shorten it.

## Behavior / UI impact
No visible UI layout changes. Only output text changes:
- Errors and HTTP debug strings will now always redact secrets more reliably.
- Very large responses will show a `<truncated>` marker.
