# Patchlog Root

This file is the *index* of patch notes for this repo.

## Recent
- Patch 417 V17: keep the V13 CI utility workflow ref SoT and EAS-link/template drift lock intact, add the missing invariant test and patch_417.md dropped by V14, and fix the (optional) assertion scope to avoid false failures on legitimately optional inputs
- Patch 416: disable intentionally retired lint/native-sync edge functions in `supabase/config.toml`, keep their 410 legacy stubs explicit, and add guard/invariant coverage against deploy drift
- Patch 415 V3: align workflow-/CI-facing edge functions on a shared admin-or-CI-bearer guard, keep wizard/keystore setup routes admin-only, update the workflow-edge contract script for the resolved trigger flow, and add dedicated invariant coverage.
- Patch 413: remove remaining silent repo/config + branch/main fallbacks across build, repo, diagnostics, diff, and CI-Lite patch-sync flows; add repo/branch SoT regression coverage
- Patch 412: harden privileged Supabase DB functions by pinning `_diagnostic_upload_guard()` to an explicit search_path, revoking accidental `PUBLIC` execute on trigger/cleanup/upload helpers, and add guard-script + invariant coverage
- Patch 410B: remove client-side Supabase service-role handling from token storage, Connections/AppInfo flows and repo-secret sync while keeping GitHub/CI secrets manual-only, plus guard coverage against drift
- Patch 411: harden Supabase deploy workflow to workflow_dispatch-only with required ref, restore single-function/_shared guards, add apply_migrations policy + metadata artifacts, and sync runbook/guard/invariant coverage
- Patch 410: separate Edge admin auth from service-role lookup, add an explicit CI service-role bearer guard, harden android-keystore-export auth fallback selection, and sync docs/TODO coverage
- Patch 409: align diagnostics upload contracts, treat upload ids as opaque strings, restore the RPC to the real bigint-backed diagnostic_uploads schema, and sync TODO/README/checklog reminders
- Patch 408: align build job id contracts to the current bigint-backed build_jobs reality, normalize numeric edge ids in app code, validate positive integer job ids in the edge layer, and sync docs/regression coverage
- Patch 407: harden repo/branch SoT for Connections/EAS prep flows, add the shared selection helper, resolve repo/branch from one source at a time, remove silent `main` fallback there, and add regression coverage
- Patch 406: add workflow↔edge contract guard, edge status docs, docs index sync, repo invariant coverage, enforce the new guards in workflow-lint CI, finalize workflow-lint trigger coverage, pin actionlint, and version-bind the installer script in workflow-lint
- Patch 405: final workflow polish for endpoint assertions, workflow-version summaries, stricter managed drift checks, and root analysis artifact cleanup
- Patch 404: finish workflow governance, fix android-keystore-export endpoint drift, sync managed guards, and update patch docs
- Patch 403: align workflow package-manager handling, target-ref deploy concurrency, repository-dispatch build flags, and EAS YAML structure
- Patch 401: memoize provider values in Project/GitHub/Terminal contexts, extend direct helper visibility coverage, and sync AGENTS guard-script checklist
- Patch 400: CI Lite SHA fallback polish + edge bootstrap metadata version alignment + real Supabase deploy metadata artifact
- Patch 399: sync CI Lite managed workflow markers, align embedded workflow sources of truth, and fix drift validation scope
- Patch 398: fix github-run-artifact-json runtime imports + restore CI Lite SHA compatibility for artifact consumers
- Patch 397: workflow traceability polish for CI Lite, Autofix and Supabase deploy metadata/artifacts
- Patch 396: production credential hardening + sanitized diagnostics
- Patch 395: harden CI Lite chain-run dispatch against default-branch workflow staleness via repository_dispatch + provenance fields
- Patch 394B: EAS manual trigger controls (`autofix` + `strict_lockfile=auto|true|false`) + trigger/template/doc sync
- Patch 394A: EAS Build strict lockfile policy for preview/production + development fallback retained + template/doc sync
- Patch 393C: documentation/checklog/patchlog sync + patch workflow instructions tightened + guard script added
- Patch 393B: Supabase deploy guarded single-function mode without regressing pinned CLI/login/link/_shared safeguards
- Patch 393A: CI Lite/Autofix pipefail + SHA pinning + Expo preflight parity + template/doc sync
- Patch 391: restore 5-provider support in k1w1-handler and add provider invariants
- Patch 390: fix edge-function helper visibility/reexports and add regression tests
- Patch 389: workflow template drift check + strict CI-Lite branch dispatch

## Historical (selected)
- Patch 388: workflow drift validator + stronger patch artifact discipline
- Patch 387: managed workflow drift hardening + CI-lite template SHA metadata + cleanup
- Patch 386: SHA hardening phase 2 + workflow marker completion + patch artifact discipline
- Patch 385: Project-context SoT correction + CI Lite artifact/autofix hardening
- Patch 383: Workflow hardening for explicit ref handling + manual-path transparency
- Patch 382: Build screen CI Lite gating + stale transparency
- Patch 381: CI Lite SoT hardening + build gate metadata persistence
- Patch 380: CI Lite dispatch robustness (ref input + auto-bootstrap on 422)
- Patch 379: Guard against flattened workflow YAML/templates + invariant test to catch newline loss
- Patch 374: CI-Lite workflows produce deterministic result JSON artifact + checkout input ref
- Patch 373: Metro blockList CI-lite env overlay + remove private metro-config import
- Patch 372: Expo/Metro ignores CI-Lite env overlay files (fix dev bundler parse error)
- Patch 371: CI-Lite workflow templates pin ESLint@8 fallback for legacy configs
- Patch 370: Patchlog restore patch_337 dual references (invariant I10)
- Patch 369: CI-Lite in-app status uses GitHub truth (fix green/rot mismatch)
- Patch 368: CI-Lite smoke diagnostics + gitignore

## Legacy patch-337 references
- docs/patches/patch_337.md
- docs/patches/PATCH_337_NOTES.md
