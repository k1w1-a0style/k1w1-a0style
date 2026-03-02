- Patch 343: correct status wording for "Offene TODO/Unknowns" (no new unknowns, but existing `: any` tech-debt item remains) (see docs/patches/patch_343.md)
- Patch 336: define verbindliches Build Readiness Gate (Matrix + Entry Point + Evidence) and update build pipeline contract (see docs/patches/patch_336.md)
- Patch 333: fix BuildPolling timeout normalization for non-Error AbortError object rejections + add regression test (see docs/patches/patch_333.md)
- Patch 332: build polling TS-hygiene hardening (`unknown` catch + typed JSON accessors) plus new regression tests for malformed JSON/legacy fields/Abort timeout (see docs/patches/patch_332.md)
- Patch 331: continue TS hygiene in EnhancedBuild BuildHistorySection (remove local any-history usage, typed CSV keys, filter-block cleanup) + full checks green (see docs/patches/patch_331.md)
- Patch 330: fix Expo GraphQL malformed-payload regression (no false-positive success on non-JSON/empty payload) + add regression tests + continue TS hygiene in useGitHubRepos (unknown catches/typed tree entries) (see docs/patches/patch_330.md)
- Patch 329: ConnectionsScreen TS hygiene bundle (component prop typing + useConnectionsScreen unknown-catch/json typings) + docs/checklog sync (see docs/patches/patch_329.md)
## Patchlog Root

- Patch 328: continue TypeScript hygiene by removing remaining `any` hotspots in `TerminalContext` + `useBuildStatus` catch hardening (`unknown` + helper) and sync TODO/checklog (see docs/patches/patch_328.md)
- Patch 326: complete `contexts/types.ts` shim removal by extracting `ProjectContextProps` to `contexts/projectTypes.ts` and deleting legacy shim files (see docs/patches/patch_326.md)
- Patch 325: remove remaining orchestrator provider `any` hotspots (gemini/groq/huggingface) + unify unknown-error handling + TODO sync (see docs/patches/patch_325.md)
- Patch 324: create prioritized fix-list from project audit and complete first orchestrator typing hardening steps (openai/anthropic/index catch + response typing) (see docs/patches/patch_324.md)
- Patch 323: reduce `any` usage in `contexts/AIContext` helpers/provider persistence + PROJECT_TODO sync (see docs/patches/patch_323.md)
- Patch 322: start contexts/types shim migration in ProjectContext imports (`AutoFixRequest`/`LastPreviewMeta` -> shared/types/project) + TODO/checklog sync (see docs/patches/patch_322.md)
- Patch 321: add minimal preview observability via `meta.debug` in `usePreview` + PROJECT_TODO/checklog sync (see docs/patches/patch_321.md)
- Patch 320: sync fix-list status (logger/apiKeyMasking review) + PROJECT_TODO alignment (see docs/patches/patch_320.md)
- Patch 319: fix preview skippedCount to include malformed file entries filtered by type guard (see docs/patches/patch_319.md)
- Patch 318: remove non-autofixable `any` typing leftovers from preview patches (314/316/317) + checklog sync (see docs/patches/patch_318.md)
- Patch 317: enforce save_preview server payload limits (max files/bytes constants) + schedule hourly cleanup_expired_previews cron + TODO/checklog sync (see docs/patches/patch_317.md)
- Patch 316: add PreviewScreen payload stats (fileCount/size/skipped) in status bar + TODO sync (see docs/patches/patch_316.md)
- Patch 315: activate ESLint `no-console` as warning baseline (allow warn/error) + TODO/checklog sync (see docs/patches/patch_315.md)
- Patch 309: sync TODO/PROJECT_TODO with implemented Patch-217/SoT state + checklog update (see docs/patches/patch_309.md)
- Patch 308: add OpenAI payload hardening regression tests + TODO/checklog sync (see docs/patches/patch_308.md)
- Patch 258: sanitize camelCase serviceRoleKey in nested arrays
- Patch 255: harden error sanitization (redact sensitive keys in details)
- Patch 253: fix notificationService Jest token (Platform.OS safe)
- Patch 251: fix jest push token skip detection
- Patch 248: Fix Jest failure for Push Token when Android FCM is not configured
- Patch 271: fix Expo token test + improve build job error handling (see docs/patches/patch_271.md)
- Patch 272: include AIContext provider-mode stability improvements (see docs/patches/patch_272.md)
- Patch 273: add in-app debug overlay + structured logging for connection tests and workflow/build calls (see docs/patches/patch_273.md)
- Patch 275: fix ChatComposer send button state (define canSend) + allow submit when file attached
- Patch 276: unify chat/header buttons (filled) + persist Expo token on test + robust EAS status check (GraphQL fallback)
- Patch 277: fix ConnectionsScreen EAS test TS regressions (missing helper, duplicate keys, hoist-safe callback order)
- Patch 278: fix ConnectionsScreen EAS test compile errors (declare state, remove missing toast, remove duplicate return keys)

- patch_280: fix CI Lite header palette key (danger -> error) + cleanup accidental root file note

- Patch 282: add app blueprint docs + enforce branch selection in Build screen (no silent main fallback)
- Patch 283: apply full refactoring bundle + fix FileActionsModal theme import (see docs/patches/patch_283.md)
- Patch 284: hotfix truncated refactor files + restore helper re-exports (see docs/patches/patch_284.md)
- Patch 285: fix WorkflowRunDetailModal imports + remove invalid MessageItem.styles default export (see docs/patches/patch_285.md)
- Patch 286: TS typecheck recovery + missing exports/imports (see docs/patches/patch_286.md)
- Patch 287: fix syntax regressions (MessageItem, terminal helpers, usePreview) (see docs/patches/patch_287.md)
- Patch 288: fix remaining TS/export issues + diagnostic runner duplication (see docs/patches/patch_288.md)

- Patch 290: add regression test for change summary + extract builder helper

- Patch 291: RepoScreen overhaul (persistent repo/branch, sync, manage, diff, dirty, push/pull) (see docs/patches/patch_291.md)

- Patch 292: fix TS hoist order in RepoScreen hook (refreshSyncStatus TDZ) (see docs/patches/patch_292.md)

- Patch 293: RepoScreen UI cleanup (no close panels, auto repos, per-repo actions, branch actions in dropdown, secrets sync button, single diff section) (see docs/patches/patch_293.md)

- Patch 300: RepoScreen polish (remove filter UI) + Pull supports text dotfiles (.gitignore/.easignore/etc) (see docs/patches/patch_300.md)

- Patch 301: RepoScreen restore showRepoList gating (fix repo list hidden test + optional flows) (see docs/patches/patch_301.md)

- Patch 302: Fix EAS/CI workflow-dispatch 404 (auto-resolve + bootstrap managed workflows) (see docs/patches/patch_302.md)

- Patch 305: Fix CI/EAS workflow dispatch 404 robustly (resolve workflow id by path, auto-bootstrap managed workflows, retry until registered) (see docs/patches/patch_305.md)
- Patch 306: CI-Lite parser hardening + Diagnostics KI-Fix-Flow + Connections EAS-Link-UX + Preview originWhitelist fix + Model/UX refresh (see docs/patches/patch_306.md)
- Patch 307: remove remaining expo lint warnings in diagnostics components + sync README patch status (see docs/patches/patch_307.md)

- Patch 310: project audit for open tasks + checklog update (see docs/patches/patch_310.md)

- Patch 311: tighten EnhancedBuildScreen typing (remove any-casts in hook/helpers + enrich CurrentBuildLike) (see docs/patches/patch_311.md)

- Patch 312: make One-Click Deploy secret sync opt-in (default off) with persistent toggle + TODO closure (see docs/patches/patch_312.md)

- Patch 313: split PreviewScreen UI into DeviceFrame/PreviewToolbar/PreviewStatusBar + TODO sync (see docs/patches/patch_313.md)

- Patch 314: add preview_page toggles for raw logs/runtime errors + PR-9 TODO sync (see docs/patches/patch_314.md)
- Patch 327: ProjectContext error-handling hardening (`catch unknown` + zentraler Fehlertext-Helper), TODO/checklog sync (see docs/patches/patch_327.md)

- Patch 334: add verbindliche SoT-Dokumentation (State Contract + Build Pipeline + Screen Index + Risk Hotspots) (see docs/patches/patch_334.md)

- Patch 335: Contract-Test Coverage Matrix + priorisierte Smoke/Invariant-Testvorschläge (siehe docs/patches/patch_335.md)

- Patch 337 (2026-03-01): Diagnostics/Fix Playbook + Test Matrix + Runbook (see docs/patches/patch_337.md and docs/patches/PATCH_337_NOTES.md)

- Patch 338 (2026-03-01): Phase-2 Diagnostics Coverage (13 neue High/Med Tests) + eas.json parse-fail Fix + Patch-Engine Helper (see docs/patches/patch_338.md)
- Patch 339 (2026-03-01): Phase-4 Testability DX (DI exports for readiness/pipeline/preflight/patch engine), stable readiness error codes, and 3 medium diagnostics tests (sorting, SmartFix fixable-only, runner resilience) (see docs/patches/patch_339.md)

- Patch 340 (2026-03-02): Phase 6+7 E2E smoke fixtures/tests + release-readiness hardening docs/report (see docs/patches/patch_340.md)

- Patch 341 (2026-03-02): Stability Hardening – No-Network Jest guard + patch engine idempotency + diagnostics determinism tests (see docs/patches/patch_341.md)

- Patch 342 (2026-03-02): Documentation hardening pass (product flows, operator runbook, screen-flow map, state quickref, docs lint + index consistency) (see docs/patches/patch_342.md)

- Patch 343 (2026-03-02): Docs Finalization Pack (Runbook + Product Flows + Screen Map + SoT Quickref + Docs-Lint) (see docs/patches/patch_343.md)
