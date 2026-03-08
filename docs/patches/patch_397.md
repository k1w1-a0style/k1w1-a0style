# Patch 397

Date: 2026-03-08

## Summary
Add lightweight workflow traceability polish on top of the current CI Lite / Autofix / Supabase deploy flows without changing the Patch 395 dispatch architecture.

## Changes
- `k1w1-ci-lite.yml`
  - keep dual trigger architecture from Patch 395
  - add `WORKFLOW_VERSION=397`
  - capture `ci-logs/metadata.env`, `ci-logs/node-version.log`, `ci-logs/npm-version.log`
  - extend `ci-lite-result.json` with run/sha metadata
  - include run id + attempt in artifact name
- `k1w1-ci-lite-autofix.yml`
  - keep `workflow_dispatch` trigger and repository-dispatch chain-run from Patch 395
  - add `WORKFLOW_VERSION=397`
  - capture `ci-logs/metadata.env`, `ci-logs/node-version.log`, `ci-logs/npm-version.log`
  - extend `ci-lite-autofix-result.json` with run/sha metadata
  - include run id + attempt in artifact name
- `deploy-supabase-functions.yml`
  - add run-name
  - write `ci-logs/deploy-metadata.env`
  - add deploy summary + metadata artifact

## Guardrails
- No regression of Patch 395 chain-run architecture.
- No change to existing functional gates or secrets handling.
- No new helper scripts required.

## Validation
Run:
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
