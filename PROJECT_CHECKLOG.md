- 2026-03-08 Patch 397: workflow traceability polish for CI Lite / Autofix / Supabase deploy metadata and artifact naming
- 2026-03-08 Patch 396: production credential hardening + sanitized diagnostics
- 2026-03-08 Patch 395: hardened CI Lite chain-run dispatch against default-branch workflow staleness by switching chain-run to repository_dispatch and surfacing workflow provenance in CI Lite artifacts/summaries
- 2026-03-08 Patch 394B: EAS manual trigger controls add guarded autofix + strict_lockfile override passthrough and docs/guard sync
- 2026-03-08 Patch 394A: EAS Build enforces strict lockfile policy for preview/production, keeps development fallback, updates workflow template/docs, and adds guard script
- 2026-03-08 Patch 393C: documentation/checklog/patchlog sync + patch workflow instructions tightened + guard script added
- 2026-03-08 Patch 393B: Supabase deploy workflow gains guarded single-function dispatch without regressing pinned CLI/login/link/_shared safeguards
- 2026-03-08 Patch 393A: CI Lite/Autofix pipefail + SHA pinning + Expo preflight parity + template/doc sync

Patch 373 applied: metro config blockList without metro-config internal imports.
- 2026-03-05 Patch 374: CI-Lite workflows + templates emit deterministic result JSON artifact
- 2026-03-05 Patch 379: Prevent flattened CI-lite workflow YAML (invariants + edge guard)
2026-03-05 - Applied patch 380: CI Lite dispatch robustness (ref input + auto-bootstrap on 422)
- 2026-03-06 Patch 381: CI Lite SoT hardening + build gate metadata persistence
- 2026-03-06 Patch 382: Build screen CI Lite gating + stale transparency
- 2026-03-06 Patch 383: Workflow hardening for explicit ref handling + manual-path transparency
- 2026-03-06 Patch 385: Project-context SoT correction + CI Lite artifact/autofix hardening
- 2026-03-06 Patch 386: SHA hardening phase 2 + workflow marker completion + patch artifact discipline
- 2026-03-06 Patch 387: managed workflow drift hardening + CI-lite template SHA metadata + cleanup
- 2026-03-06 Patch 388: workflow drift validator + stronger patch artifact discipline
- 2026-03-06 Patch 389: workflow template drift check + strict CI-Lite branch dispatch
- 2026-03-07 Patch 390: fix edge-function helper visibility/reexports and add regression tests
- 2026-03-07 Patch 391: restore 5-provider support in k1w1-handler and add provider invariants
