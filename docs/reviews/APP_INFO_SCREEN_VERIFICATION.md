# AppInfoScreen Verification (Patch 69)

## Review findings covered

### ✅ Fixed / hardened

- **A-001 (P1) API keys were rendered in clear text**
  - Keys are now **masked by default** and can be **temporarily revealed** per provider (auto-hides).
  - Prevents accidental leakage via screenshots / screen-sharing.

- **A-002 (P1) Import API config semantics didn't match UI copy**
  - Import now **replaces** the current AI config (as the UI says), instead of only appending keys.
  - Imported config is **sanitized** (trim, dedupe, drop empty, enforce provider buckets).

- **A-003 (P1) Weak backup validation**
  - Import validates the JSON shape and fails early with a clear error if the file is not a supported backup.
  - Export-date formatting is defensive.

### ✅ Tech/perf cleanups

- **A-005 (P3) Template resolution was recalculated frequently**
  - Template resolution is memoized to avoid repeated work on re-renders.

## Tests

- Added a unit test file for:
  - API key masking behavior
  - Backup validation + AI config sanitization

## UI impact

- No layout rewrite.
- Only visible change: API keys are masked by default, with an eye/eye-off toggle.

---

## Patch 70 follow-up

Fixes after first integration:

- **Typecheck:** backup sanitizer now returns a valid `AIConfig` (no stray `selectedAutofixProvider`).
- **Compatibility:** accepts legacy `selectedAutofixProvider` by mapping it to `selectedAgentProvider`.
- **Validation:** backup JSON validation rejects invalid `apiKeys` shapes (must be an object when present).

UI remains unchanged.

---

## Patch 175 follow-up

Key Backup/Restore was extended to cover new secret surfaces that appeared in the project:

- **Signing keys:** supports optional `SIGNING_MASTER_KEY` (SecureStore) and nutzt getrennte lokale Secret-Slots fuer `workflowAdminKey`, `androidKeystoreExportAdminKey`, `legacyEdgeAdminKey` und `signingAdminKey`; CI-Secret-Export mappt diese Werte bewusst 1:1 auf `K1W1_EDGE_WORKFLOW_ADMIN_KEY`, `K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY`, `K1W1_EDGE_ADMIN_KEY` und `SIGNING_ADMIN_KEY` ohne stilles Spiegeln eines Einzelwerts.
- **Token bundle:** export includes a normalized `tokens` object and a `ciSecrets` map (import accepts both shapes).
- **No UI change required:** existing AppInfoScreen "Full Backup" action is enough; the additional fields are purely structural.

Recommended verification:
- Export Full Backup and confirm the JSON contains `tokens` and `ciSecrets`.
- Re-import and confirm tokens/keys persist and the app stays stable.
