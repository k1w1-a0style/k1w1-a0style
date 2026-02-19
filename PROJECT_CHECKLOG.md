# Project Checklog

- Patch 194 (2026-02-19): EnhancedBuildScreen — split helpers + preconditions hook (no behavior change)
- Patch 193 (2026-02-19): EnhancedBuildScreen — extract run-details fetch helper; reduce duplication
- Patch 192.3 (2026-02-19): Hotfix — stabilize One-Click Deploy tests (prevent hang/timeout)
- Patch 192.2 (2026-02-19): Hotfix — fix One-Click Deploy Jest mocks using require.resolve
- Patch 192.1 (2026-02-19): Hotfix — fix Jest module mock paths in One-Click Deploy tests
- Patch 192 (2026-02-19): One-Click Deploy — check Signing Key before tokens; fix Jest mocks for One-Click Deploy tests
- Patch 191 (2026-02-19): EnhancedBuildScreen cleanup — remove dead run-detail loader; add One-Click Deploy tests
- Patch 190 (2026-02-19): One-Click Deploy — enforce Signing Key (no skip) + whitespace cleanup


- Patch 186 (2026-02-18): Diagnostic UX — tabs removed; scan/fix-only flow; checklist + issues list

- Patch 185 (2026-02-18): Repo screen UX — dropdown repo picker, secrets list, diff file preview; Build screen removes GitHub Actions UI; Diagnostic adds profile headline + debug-to-chat

- Patch 184 (2026-02-18): Hotfix — fix Patch 183 typecheck/lint regressions (hook ordering, missing styles, WorkflowRun typing, FileSystem imports)

- Patch 183 (2026-02-18): Flow unification — repo/branch+profile persistence; Enhanced Build actions/history; turbo checklist chips

- Patch 182 (2026-02-18): CI Lite progress hotfix — fix TS palette key + add missing StyleSheet keys

- Patch 178 (2026-02-17): Sidebar/Header theme align — hairline borders + color unify; CI Lite GitHub logs token passthrough + edge fallback

- Patch 175 (2026-02-17): AppInfoScreen Key Backup — include signing keys + token bundle (SIGNING_MASTER_KEY / SIGNING_ADMIN_KEY)

- Patch 173 (2026-02-17): PR-8 Stage 7 — normalize blocking import audit + add preflight:fast + docs alignment
- Patch 172 (2026-02-17): PR-8 Stage 6 — make import drift audit blocking (preflight enforced)
- Patch 171 (2026-02-17): PR-8 Stage 5 — add import drift audit (contexts/types Build* imports)
- Patch 170 (2026-02-17): PR-8 Stage 4 — prefer shared build type imports (no alias)
- Patch 169 (2026-02-17): PR-8 Stage 3 — type drift guardrails (eslint boundaries + audit)
- Patch 168 (2026-02-17): PR-8 Stage 2 — unify project/context types via shared types + shim exports
- Patch 167 (2026-02-17): PR-8 Stage 1 — unify build types (single source of truth in shared/types)
Recent changes, most recent first.

- Patch 163 (2026-02-17): PR-7 Stage 4 — enforce facade import bans via ESLint errors (guardrail now fails CI)
- Patch 166 (2026-02-17): PR-8 kickoff — post-PR-7 verification: hardened facade-removal audit + doc alignment
- Patch 165 (2026-02-17): Patch 164 follow-up — fix docs + update refactor scripts after facade removal
- Patch 164 (2026-02-17): PR-7 Stage 5 — remove legacy facades after all imports migrated
- Patch 162 (2026-02-17): PR-7 Stage 3.1 — tighten facade audit + fix remaining facade imports
- Patch 161 (2026-02-17): PR-7 Stage 3 — deprecate facades + add facade import audit script
- Patch 160 (2026-02-17): PR-7 Stage 2 — migrate internal imports away from facades (infra + diagnostics)
- Patch 159 (2026-02-17): PR-7 Stage 1 — add warn-only ESLint guardrails to discourage new facade imports

- Patch 158 (2026-02-17): PR-6 Stage 4 — move checklist runner into diagnostics (facade removed later in Patch 164)
- Patch 157 (2026-02-17): PR-6 Stage 3 — extract template checklist patchers/defaults into dedicated modules
- Patch 156 (2026-02-17): PR-6 Stage 2 — templates barrel exports; templateChecklist imports simplified
- Patch 155.1 (2026-02-17): Hotfix — PR-6 Stage 1 type fixes (Toolchain typing + TemplateFileMap)
- Patch 155 (2026-02-17): PR-6 Stage 1 — modularize template checklist building blocks

- Patch 154.1 (2026-02-17): Hotfix — remove duplicate useBuildStatus import in ProjectContext (restores typecheck + tests)
- Patch 154 (2026-02-17): PR-5 Stage 3 — build polling moved out of ProjectContext (useBuildStatus + buildPollingService)
- Patch 153 (2026-02-16): PR-5 Stage 2 — extract archive + build trigger services; ProjectContext slimmer
- Patch 152 (2026-02-16): PR-5 Stage 1 — extract template loader + file mutations; ProjectContext slimmer

- Patch 151 (2026-02-16): PR-4 Stage 2 — GitHub infra split into modules; public API preserved via barrel exports
- Patch 150 (2026-02-16): PR-4 Stage 1 — GitHub service moved to infra/github with contexts facade
- Patch 149 (2026-02-16): PR-3 — build polling extracted to project/services; useBuildStatus remains single hook
- Patch 148 (2026-02-16): PR-2 — storage persistence moved to infra/storage with contexts facade
- Patch 147 (2026-02-16): V3.1 scaffolding (shared/types + docs/refactor + scripts/refactor)

## Patch 179
- CI Lite workflow dispatch uses device GitHub token and CI Lite workflows are allowlisted for repo sync.
- Header action buttons use chat-like green tint and hairline borders.

## Patch 180
- CI Lite header button: unified header styling + pulsing ring while checks run; success icon stays green without heavy fill.
- CI Lite no longer auto-pushes before dispatch (prevents unexpected build triggers).
- Auto-sync after applying a CI Lite patch: touched files are mirrored to repo/branch (and deletions removed).
- github-workflow-dispatch edge function now accepts `githubToken` from request body (fixes 'githubToken is not defined').
- Drawer selected branch + active item uses thin neon outline + soft glow.

## Patch 181
- CI Lite Modal: Progress-Bar + Prozent (heuristisch) und Shimmer-Animation während Checks laufen.
- Besseres Live-Feedback ohne Einfluss auf die bestehende CI-Lite Logik (Dispatch/Polling/Results/Patch-Apply).
- 2026-02-18: Patch 188 prepared — RepoScreen polish + ignore cleanup.
- 2026-02-18: Patch 189 hotfix — fix Patch 188 build blockers (JSX syntax + duplicate searchTerm + missing TouchableOpacity import).
- Patch 194.1: hotfix build screen hook parse error
- 2026-02-19: Patch 198 — BuildStatus imports moved to `shared/types/build` (reduces re-export drift; no behavior change).
