# Project Checklog

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
