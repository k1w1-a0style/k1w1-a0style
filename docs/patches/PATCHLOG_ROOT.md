# Patchlog Root

This file is the *index* of patch notes for this repo.

## Recent
- Patch 396: production credential hardening + sanitized diagnostics

- Patch 394B: EAS manual trigger controls (`autofix` + `strict_lockfile=auto|true|false`) + trigger/template/doc sync
- Patch 394A: EAS Build strict lockfile policy for preview/production + development fallback retained + template/doc sync
- Patch 393C: documentation/checklog/patchlog sync + patch workflow instructions tightened + guard script added
- Patch 393B: Supabase deploy workflow gains guarded single-function dispatch without regressing deploy_all safeguards
- Patch 393A: harden CI Lite / Autofix with pipefail, SHA pinning, and Expo preflight parity
- Patch 391: restore 5-provider support in k1w1-handler and add provider invariants
- Patch 390: fix edge-function helper visibility/reexports and add regression tests
- Patch 389: workflow template drift check + strict CI-Lite branch dispatch
- Patch 388: workflow drift validator + stronger patch artifact discipline
- Patch 387: managed workflow drift hardening + CI-lite template SHA metadata + cleanup
- Patch 386: SHA hardening phase 2 + workflow marker completion + patch artifact discipline
- Patch 385: Project-context SoT correction + CI Lite artifact/autofix hardening
- Patch 383: Workflow hardening for explicit ref handling + manual-path transparency
- Patch 382: Build screen CI Lite gating + stale transparency
- Patch 381: CI Lite SoT hardening + build gate metadata persistence
- Patch 379: Guard against flattened workflow YAML/templates + invariant test to catch newline loss
- Patch 380: CI Lite dispatch robustness (ref input + auto-bootstrap on 422)
- Patch 374: CI-Lite workflows produce deterministic result JSON artifact + checkout input ref
- Patch 373: Metro blockList CI-lite env overlay + remove private metro-config import
- Patch 372: Expo/Metro ignores CI-Lite env overlay files (fix dev bundler parse error)
- Patch 371: CI-Lite workflow templates pin ESLint@8 fallback for legacy configs
- Patch 370: Patchlog restore patch_337 dual references (invariant I10)
- Patch 369: CI-Lite in-app status uses GitHub truth (fix green/rot mismatch)
- Patch 368: CI-Lite smoke diagnostics + gitignore

## Historical (selected)

- Patch 337: (legacy) Keep dual references for patch 337:
  - docs/patches/patch_337.md
  - docs/patches/PATCH_337_NOTES.md
