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

## Patch 216–227 (Summary)

- Patch 216: Docs/TODO/Workflow aufgeräumt.
- Patch 217–218: CI Lite Bugfixes + Supabase Edge SoT + Storage/Connection SoT + Robustness.
- Patch 219: Provider Hardening + Docs/Examples SoT polish + Connections status polish.
- Patch 220: Entfernt AI-Model "Auto" (UI) + Migration von Legacy-Configs auf konkrete Default-Modelle.
- Patch 221: Connections UX polish (Scopes Badges + Missing-Warnung) + Build/CI Shortcut + Supabase Ref/Host Anzeige + TODO/Docs Alignment.
- Patch 222: Android-only cleanup + kleine Connections/Repo Robustness.
- Patch 223: CI Lite Status persistieren + CI Lite Checklist Item im EnhancedBuildScreen.
- Patch 224: CI Lite Details (Run Meta + „in Chat übernehmen") + Connections Sync Summary + Repo Hygiene (openai removed + App.tsx format).
- Patch 225: Gemini Guard + Supabase Edge URL SoT + Logger Cleanup + Remove legacy `exportAndBuild`.
- Patch 226: Logger Sweep in GitHub/Storage Hooks.
- Patch 226.2: Hotfix für kaputten Import-Block in `hooks/useGitHubRepos.ts`.
- Patch 227: CI Lite `applyPatchFromText` deps hardening + Docs alignment.

## Offene Punkte

> Referenz: `docs/TODO.md` (Single Source of Truth).
- Refactor: `components/CiLiteHeaderButton.tsx` in kleinere Teile (Hook + UI Komponenten) aufsplitten.


## Patch 228 (2026-02-20)
- Added docs/DEV_COMMANDS.md and updated docs/INDEX.md + README for search commands without rg.


## Patch 229 (2026-02-20)
- CI Lite: extracted helpers into `components/ciLite/ciLiteUtils.ts` and aligned usages.
- CI Lite: minor robustness/UX improvements + docs alignment.

## Patch 230 (2026-02-21)
- Bundle: Patch 227–229 als ein Apply-ZIP (CI Lite SoT + DEV_COMMANDS + Docs Alignment).
- Patchlog/Index ergänzt (`docs/patches/patch_230.md`).

## Patch 231 (2026-02-21)
- Android-only wording cleanup (remove iOS confusion)

## Patch 232 (2026-02-23)
- Docs/Templates: Android-only wording sweep (workflow docs + templates) while keeping EAS safety guard rationale intact.
- ChatScreen: comment wording cleanup (no iOS mention).

## Patch 233 (2026-02-23)
- Docs/History purge: removed remaining non-target platform wording from documentation/history (text-only).


## Patch 234 (2026-02-23)
- Runtime robustness: Gemini consecutive-role merge + Supabase Edge URL guard + legacy provider safety + logger cleanup.

- 2026-02-23: Patch 235 prepared
- 2026-02-23: Patch 236 prepared (hotfix: broken import block in WorkflowRunDetailModal). Run `npm run test:silent` + `npm run typecheck` after apply. (post-234 cleanup). Run `npm run test:silent` after apply.

- 2026-02-23: Patch 237 prepared (remove placeholder model contextWindow metadata).
- 2026-02-23: Patch 238 prepared (contextWindow smoke values per provider to satisfy integration test).

- 2026-02-23: Patch 239 prepared (stability sweep: FileWriter no silent drops + disable broken build.js + rotateApiKeyOnError cleanup + targeted logger hygiene + Groq model fallback).
