# Project Checklog

- Patch 200 (2026-02-19): PR-9 Stage 1 — Preview Screens Refactoring: extract hooks, shared WebView utils, fix critical dead-code bug in PreviewFullscreenScreen
- Patch 199 (2026-02-19): Test infra — set global Jest timeout to reduce flakiness
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
- Patch 184 (2026-02-18): Hotfix — fix Patch 183 typecheck/lint regressions
- Patch 183 (2026-02-18): Flow unification — repo/branch+profile persistence; Enhanced Build actions/history; turbo checklist chips
- Patch 182 (2026-02-18): CI Lite progress hotfix — fix TS palette key + add missing StyleSheet keys
- Patch 181 (2026-02-18): CI Lite progress bar + shimmer + step feedback
- Patch 180 (2026-02-18): CI Lite UX: pulsing ring + no auto-push; branch outline/glow; dispatch token fix
- Patch 179 (2026-02-18): CI Lite dispatch reliability + header buttons theming
- Patch 178 (2026-02-17): Sidebar/Header theme align + CI Lite GitHub token passthrough

- Patch 175 (2026-02-17): AppInfoScreen Key Backup — include signing keys + token bundle
- Patch 173 (2026-02-17): PR-8 Stage 7 — normalize blocking import audit + preflight:fast + docs
- Patch 172 (2026-02-17): PR-8 Stage 6 — make import drift audit blocking
- Patch 171 (2026-02-17): PR-8 Stage 5 — add import drift audit (contexts/types Build* imports)
- Patch 170 (2026-02-17): PR-8 Stage 4 — prefer shared build type imports
- Patch 169 (2026-02-17): PR-8 Stage 3 — type drift guardrails (eslint boundaries + audit)
- Patch 168 (2026-02-17): PR-8 Stage 2 — unify project/context types via shared types + shim exports
- Patch 167 (2026-02-17): PR-8 Stage 1 — unify build types (single source of truth in shared/types)
- Patch 166 (2026-02-17): PR-8 kickoff — post-PR-7 verification + doc alignment
- Patch 165 (2026-02-17): Patch 164 follow-up — fix docs + update refactor scripts after facade removal
- Patch 164 (2026-02-17): PR-7 Stage 5 — remove legacy facades after all imports migrated
- Patch 163 (2026-02-17): PR-7 Stage 4 — enforce facade import bans via ESLint errors
- Patch 162 (2026-02-17): PR-7 Stage 3.1 — tighten facade audit + fix remaining facade imports
- Patch 161 (2026-02-17): PR-7 Stage 3 — deprecate facades + add facade import audit script
- Patch 160 (2026-02-17): PR-7 Stage 2 — migrate internal imports away from facades
- Patch 159 (2026-02-17): PR-7 Stage 1 — warn-only ESLint guardrails for facade imports

- Patch 158 (2026-02-17): PR-6 Stage 4 — move checklist runner into diagnostics
- Patch 157 (2026-02-17): PR-6 Stage 3 — extract template checklist patchers/defaults
- Patch 156 (2026-02-17): PR-6 Stage 2 — templates barrel exports
- Patch 155.1 (2026-02-17): Hotfix — PR-6 Stage 1 type fixes
- Patch 155 (2026-02-17): PR-6 Stage 1 — modularize template checklist building blocks

- Patch 154.1 (2026-02-17): Hotfix — remove duplicate useBuildStatus import in ProjectContext
- Patch 154 (2026-02-17): PR-5 Stage 3 — build polling moved out of ProjectContext
- Patch 153 (2026-02-16): PR-5 Stage 2 — extract archive + build trigger services
- Patch 152 (2026-02-16): PR-5 Stage 1 — extract template loader + file mutations

- Patch 151 (2026-02-16): PR-4 Stage 2 — GitHub infra split into modules
- Patch 150 (2026-02-16): PR-4 Stage 1 — GitHub service moved to infra/github with contexts facade
- Patch 149 (2026-02-16): PR-3 — build polling extracted to project/services
- Patch 148 (2026-02-16): PR-2 — storage persistence moved to infra/storage
- Patch 147 (2026-02-16): V3.1 scaffolding (shared/types + docs/refactor + scripts/refactor)
