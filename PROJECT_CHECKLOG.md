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
