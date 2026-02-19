# Patchlog (root)

This file is append-only. Each patch adds a short entry.

## Patch 213
- Fix missing `githubApiUrl` import in Connections screen.

## Patch 214
- Fix GitHub repo/branch source-of-truth drift (backup import + CI Lite precedence).

## Patch 215
- Centralize GitHub AsyncStorage keys + Supabase Edge function names to prevent SoT drift.

## Patch 216
- Docs: consolidate TODO + patch workflow commands; align checklog with patch flow.

## Patch 217
- CI Lite bugfixes (dead code + stale closures + polling cleanup) + Supabase edge SoT expansion + Storage key SoT + tokenStore consistency + Connection Screen SoT (persistenter Verbunden-Status, EAS init/link prompt) + optional GitHub token scopes.
