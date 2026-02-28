## Patchlog Root

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
