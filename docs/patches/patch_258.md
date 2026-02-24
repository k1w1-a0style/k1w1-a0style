# Patch 258

## Summary
Fixes secret redaction for camelCase keys like `serviceRoleKey` when sanitizing nested error `details` payloads in Supabase Edge Functions.

## Changes
- Treat `serviceRoleKey` (normalized to `servicerolekey`) as a sensitive key in `sanitizeUnknownForTransport()`, ensuring it is always replaced with `[REDACTED_SECRET]`.

## Rationale
The key-based sanitizer lowercases keys; `serviceRoleKey` did not match the existing `_key` suffix or the exact-match allowlist, so short values could slip through. This patch closes that gap and makes the new nested-array regression test pass.
