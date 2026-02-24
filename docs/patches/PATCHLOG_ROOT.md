## Patchlog Root

- Patch 265: make edge CORS helpers Node/Jest-safe (avoid direct Deno global references)
- Patch 263b: enable allowImportingTsExtensions to allow Supabase Edge `.ts` imports in repo typecheck
- Patch 258: sanitize camelCase serviceRoleKey in nested arrays
- Patch 255: harden error sanitization (redact sensitive keys in details)
- Patch 253: fix notificationService Jest token (Platform.OS safe)
- Patch 251: fix jest push token skip detection
- Patch 248: Fix Jest failure for Push Token when Android FCM is not configured