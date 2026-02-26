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
