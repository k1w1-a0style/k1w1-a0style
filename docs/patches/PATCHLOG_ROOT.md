## Patchlog Root

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
