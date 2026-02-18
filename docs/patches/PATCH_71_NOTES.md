# Patch 71 — CredentialsWizardScreen hardening + privacy

Date: 2026-02-12

## Summary
This patch tightens the Credentials Wizard around privacy, correctness, and async safety.

## Changes
- **Privacy:** sanitize debug payloads + errors (redaction of JWT-like tokens and common key/value secrets) + size caps.
- **Correctness:** single-flight guard for Generate; avoids double-tap races.
- **Stability:** mounted-guarded state updates; avoids setState-after-unmount warnings.
- **Validation:** stronger checks for Supabase URL / admin key / repo full name before any Edge call.
- **Types:** reduce `any` in Edge invocation path.
- **Tests:** add focused unit tests for sanitizer + validators.

## Files
- `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts`
- `screens/CredentialsWizardScreen/utils/security.ts`
- `__tests__/credentialsWizardSecurity.test.ts`
- `docs/reviews/CREDENTIALS_WIZARD_SCREEN_VERIFICATION.md`
- `docs/TODO.md`
- `PROJECT_CHECKLOG.md`
