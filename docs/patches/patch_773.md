# Patch 773 — RateLimitTrustedProxyHeaderBypassFix

## Scope
- Shared Edge rate-limit subject trust model hardening against client-header spoofing.
- Auth rate-limit subject tests aligned to secure trust/degradation semantics.

## Changes
- `supabase/functions/_shared/auth/rateLimit.ts`
  - removed trust derivation from `x-k1w1-trusted-proxy` request header.
  - `x-forwarded-for` is now only considered when `K1W1_TRUSTED_PROXY_HOPS` is configured server-side as a positive integer.
  - client IP is derived from the untrusted edge of the forwarded chain (`entries.length - (trustedProxyHops + 1)`), so prepended spoof values do not control the subject.
  - invalid/missing proxy-hop configuration degrades fail-safe (no forwarded trust).
- `__tests__/authRateLimitSubject.test.ts`
  - former client-marker acceptance case now asserts fail-safe rejection.
  - added explicit trusted server configuration case (`K1W1_TRUSTED_PROXY_HOPS=1`).
  - added misconfiguration degradation case (`K1W1_TRUSTED_PROXY_HOPS=abc`).

## Validation
- `npm run test:silent -- --runInBand authRateLimitSubject.test.ts auth.localRateLimitPruneWindow.test.ts auth.failClosedAndDurableRateLimit.test.ts`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_eas_manual_trigger_controls.sh`
- `bash scripts/check_eas_production_credentials.sh`
- `bash scripts/check_eas_strict_lockfile_policy.sh`
- `bash scripts/check_edge_helper_visibility.sh`
- `bash scripts/check_k1w1_handler_providers.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `bash scripts/check_supabase_deploy_workflow.sh`
- `bash scripts/check_supabase_rls_hardening.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
