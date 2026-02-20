# Project Checklog

## Patch 213
- Fixed missing `githubApiUrl` import in `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`.
- Typecheck/lint/tests should pass again after patch 211/212 changes.

## Patch 214
- Fix GitHub repo/branch source-of-truth drift:
  - Prefer `GitHubContext` active repo/branch in CI Lite.
  - Persist repo/branch into `ProjectContext` during backup import so hydration cannot snap back.

## Patch 215
- Centralize GitHub + Supabase “source of truth” strings:
  - GitHub AsyncStorage keys live in `shared/constants/github.ts`.
  - Supabase Edge function names live in `shared/constants/supabase.ts`.

## Offene Punkte (noch nicht gepatcht)

> Referenz: `docs/TODO.md` (Single Source of Truth).

- CI Lite Bugfixes (CiLiteHeaderButton): Dead code `topContent`, stale-closure in `applyPatchFromText`, unmount cleanup für Polling.
- Supabase Edge function SoT: fehlende Constants (`check-eas-build`, `save_preview`) + Hardcodes entfernen.
- `buildPollingService`: dupliziert `getSupabaseEdgeUrl` statt `lib/supabaseEdge.ts` zu nutzen.
- Storage-Key SoT: `diagnostic_last_ok` zentralisieren.
- TokenStore: SecureStore Error-Handling vereinheitlichen.

## Pending
- Patch 217: apply `k1w1-a0style_patch_217_FIXED.zip` (CI Lite bugfix + SoT Edge/Storage + Connection Screen SoT). Danach typecheck/lint/tests und TODO abhaken.


## Patch 217 (geplant/ausstehend)
- CI Lite Bugfixes + SoT Edge Functions + SoT Storage Keys
- Connection Screen: persistenter Verbunden-Status (inkl. EAS Init+Link Warn-Dialog)

## Patch 218 (pending)
- Connections Screen SoT Edge-Cases: reset flags on token deletion, GitHub scopes persist/unknown, deps fix

- 2026-02-19: Patch 219 (AI provider hardening + docs/examples SoT polish + Connections status polish)
