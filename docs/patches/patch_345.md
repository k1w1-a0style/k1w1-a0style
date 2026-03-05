# Patch 345: CI Lite workflow-dispatch 404 hardening (autofix template)

Date: 2026-03-05

## Problem
CI Lite dispatch could fail with **404 workflow not found** when the app triggers `k1w1-ci-lite-autofix.yml`, because the Supabase Edge Function `github-workflow-dispatch` only knew how to bootstrap `k1w1-ci-lite.yml` and `k1w1-diagnostics.yml`.

## Fix
- Added **bootstrap template** for `k1w1-ci-lite-autofix.yml` to `supabase/functions/github-workflow-dispatch/index.ts`.
- Extended workflow alias mapping to include `autofix` / `ci-autofix` / `ci-lite-autofix`.

## Notes
This keeps the edge function self-contained (templates live inside the function) and preserves the existing retry logic that waits for GitHub to register newly created workflows before dispatching by workflow **ID**.
