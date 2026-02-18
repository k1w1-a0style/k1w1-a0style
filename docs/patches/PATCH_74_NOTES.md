# Patch 74 Notes

## What changed
- Fix TypeScript mismatch in CredentialsWizardScreen tests: `WizardHttpDebug` no longer requires `status` / `statusText`.
- `sanitizeWizardHttpDebug` forwards `ms` (duration) and handles missing `statusText` safely.

## Why
The tests intentionally pass a minimal debug object (URL/method/ms/bodyText). The stricter type required `status` and `statusText`, blocking typecheck.

## UI impact
None.
