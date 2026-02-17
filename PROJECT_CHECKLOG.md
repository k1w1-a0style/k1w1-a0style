# Project Checklog

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
