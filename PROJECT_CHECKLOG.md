# Project Checklog

- Patch 160 (2026-02-17): PR-7 Stage 2 – migrate internal imports away from facades (infra + diagnostics)
- Patch 160 (2026-02-17): PR-7 Stage 2 – migrate internal imports away from facades (infra/github, infra/storage, diagnostics/templates)
- Patch 159 (2026-02-17): PR-7 Stage 1 – add warn-only ESLint guardrails to discourage new facade imports
- Patch 158 (2026-02-17): PR-6 Stage 4 – move checklist runner into diagnostics; templateChecklist becomes a thin facade
- Patch 157 (2026-02-17): PR-6 Stage 3 – extract template checklist patchers/defaults into dedicated modules (templateChecklist as facade)
- Patch 156 (2026-02-17): PR-6 Stage 2 – templates barrel exports; templateChecklist imports simplified

- Patch 155.1 (2026-02-17): Hotfix — PR-6 Stage 1 type fixes (Toolchain typing + TemplateFileMap)

- Patch 155 (2026-02-17): PR-6 Stage 1 – modularize template checklist building blocks

- Patch 154.1 (2026-02-17): Hotfix — remove duplicate useBuildStatus import in ProjectContext (restores typecheck + tests)
- Patch 154 (2026-02-17): PR-5 stage 3 — build polling moved out of ProjectContext (useBuildStatus + buildPollingService)
- Patch 153 (2026-02-16): PR-5 stage 2 — extract archive + build trigger services; ProjectContext slimmer
- Patch 152 (2026-02-16): PR-5 stage 1 — extract template loader + file mutations; ProjectContext slimmer
- Patch 151 (2026-02-16): GitHub infra split into modules; public API preserved via barrel exports (PR-4 stage 2)
- Patch 150 (2026-02-16): GitHub service moved to infra/github with contexts facade (PR-4 stage 1)
- Patch 149 (2026-02-16): Build polling extracted to project/services; useBuildStatus remains single hook (PR-3)
- Patch 148 (2026-02-16): Storage persistence moved to infra/storage with contexts facade (PR-2)
- Patch 147 (2026-02-16): V3.1 scaffolding (shared/types + docs/refactor + scripts/refactor)
