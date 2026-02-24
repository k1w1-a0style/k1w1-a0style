# Patch 255: Harden error sanitization (key-based redaction)

## Summary
Tightens Edge Function error sanitization so that **sensitive keys** inside `details` are always redacted,
even if their values are short and do not match the existing token/secret regex patterns.

## Why
Some error objects (DB errors, upstream API errors, wrapper objects) may contain fields like `token`, `authorization`,
`apiKey`, `service_role_key`, etc. Even if the values are short (and therefore not matched by `LONG_SECRET_RE`),
they should never be returned to clients.

## Changes
- `_shared/errorSanitization.ts`
  - Added `isSensitiveKey()` helper and a small allowlist of common sensitive key names.
  - When deep-sanitizing objects, values under sensitive keys are replaced with `[REDACTED_SECRET]`.

## Notes
- Existing pattern-based redaction (JWT / `ghp_` / Bearer / long-secret heuristic) remains intact.
- This is defense-in-depth; it does not change success responses.
