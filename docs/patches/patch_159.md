# Patch 159

## Summary

PR-7 Stage 1: Add **warn-only refactor guardrails** to reduce accidental new imports from facade modules.

## Changes

- `eslint.config.js`
  - Add `no-restricted-imports` as **warn-only** (CI uses `eslint --quiet`, so it does not fail builds).
  - Warn when importing from:
    - `lib/templateChecklist` → prefer `lib/diagnostics/templates`
    - `contexts/githubService` → prefer `infra/github/*`
    - `contexts/projectStorage` → prefer `infra/storage/projectPersistence`

## Why

We keep facade files temporarily for compatibility, but we want to stop **new** code from depending on them.
These warnings make the migration path obvious without breaking CI.
