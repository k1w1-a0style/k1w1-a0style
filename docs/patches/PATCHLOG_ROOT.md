# Patch Log

Most recent first.

- Patch 209: `docs/patches/patch_209.md` (Types: ProjectContext imports shared types directly; shrink contexts/types shim)
- Patch 208: `docs/patches/patch_208.md` (Docs: refresh handoff + TODO to match current patch state)
- Patch 207: `docs/patches/patch_207.md` (Tests: stop mocking deleted GitHubReposScreen legacy sections)
- Patch 206: `docs/patches/patch_206.md` (Cleanup: remove unused legacy screen sections)
- Patch 205: `docs/patches/patch_205.md` (Cleanup: remove leftover dead-code shims)

- Patch 204: `docs/patches/patch_204.md` (Fix: revert over-aggressive Patch 203 cleanup; keep contexts/types + lib/logger)

- Patch 203: `docs/patches/patch_203.md` (Cleanup: remove dead files + finish BuildStatus import migration)

- Patch 202.3: `docs/patches/patch_202_3.md` (Hotfix: restore missing `ProjectFile` type imports after Patch 202)

- Patch 202.2: `docs/patches/patch_202_2.md` (Hotfix: repair malformed `import type` blocks from Patch 202)

- Patch 202.1: `docs/patches/patch_202_1.md` (Hotfix: fix broken type-only import blocks from Patch 202)

- Patch 202: `docs/patches/patch_202.md` (Migrate imports off contexts/types to shared/types/*)

- Patch 201: `docs/patches/patch_201.md` (Guardrails: deprecate legacy type shims to prevent future import drift)

- Patch 200: `docs/patches/patch_200.md` (PR-9 Stage 1: Preview Screens Refactoring + critical bug fix in PreviewFullscreenScreen)

- Patch 199: `docs/patches/patch_199.md` (Test infra: set global Jest timeout to reduce flakiness)

- Patch 194: `docs/patches/patch_194.md` (EnhancedBuildScreen: split helpers + preconditions hook; no behavior change)

- Patch 193: `docs/patches/patch_193.md` (EnhancedBuildScreen: extract run-details fetch helper; reduce duplication)

- Patch 192.3: `docs/patches/patch_192_3.md` (Hotfix: stabilize One-Click Deploy tests; prevent hanging/timeout)
- Patch 192.2: `docs/patches/patch_192_2.md` (Hotfix: fix Jest mocks using require.resolve + deterministic imports)
- Patch 192.1: `docs/patches/patch_192_1.md` (Hotfix: fix Jest module mock paths in One-Click Deploy tests)

- Patch 192: `docs/patches/patch_192.md` (Fix One-Click Deploy tests; check Signing Key before tokens)
- Patch 191: `docs/patches/patch_191.md` (Refactor: remove dead run-detail loader; add One-Click Deploy tests)
- Patch 190: `docs/patches/patch_190.md` (Hotfix: enforce Signing Key in One-Click Deploy; whitespace cleanup)

- Patch 189: `docs/patches/patch_189.md` (Hotfix: Patch 188 build blockers — JSX syntax + duplicate var + missing import)
- Patch 188: `docs/patches/patch_188.md` (RepoScreen polish: dropdown/filter UX + diff/secrets usability + ignore cleanup)
- Patch 187: `docs/patches/patch_187.md` (Hotfix: Repo screen TS palette + missing hook exports)

- Patch 186: `docs/patches/patch_186.md` (Diagnostic: remove tabs, simplify to Scan/Fix + checklist)

- Patch 185: `docs/patches/patch_185.md` (Repo screen: secrets + diff + dropdown; Build actions UI removed; Diagnostic debug-to-chat)

- Patch 184: `docs/patches/patch_184.md` (Hotfix Patch 183: typecheck/lint fixes)

- Patch 183: `docs/patches/patch_183.md` (Flow unification + Build UX + Turbo checklist chips)

- Patch 182: `docs/patches/patch_182.md` (CI Lite progress hotfix: TS palette + missing styles)

- Patch 181: `docs/patches/patch_181.md` (CI Lite progress bar + shimmer + step feedback)

- Patch 180: `docs/patches/patch_180.md` (CI Lite UX: pulsing ring + no auto-push; branch outline/glow; dispatch token fix)

- Patch 179: `docs/patches/patch_179.md` (CI Lite dispatch reliability + header buttons theming)

- Patch 178: `docs/patches/patch_178.md` (Sidebar/Header theme align + CI Lite GitHub token passthrough)

- Patch 177: `docs/patches/patch_177.md` (Sidebar polish + CI Lite header repo fix)

- Patch 175: `docs/patches/patch_175.md` (AppInfoScreen Key Backup: signing keys + token bundle)

- Patch 174: `docs/patches/patch_174.md` (Fix import drift audit script: regex + executable)
- Patch 173: `docs/patches/patch_173.md` (Normalize import drift audit + preflight:fast + docs)

- Patch 172: `docs/patches/patch_172.md` (PR-8 Stage 6: make import drift audit blocking)
- Patch 171: `docs/patches/patch_171.md` (PR-8 Stage 5: add import drift audit)
- Patch 170: `docs/patches/patch_170.md` (PR-8 Stage 4: prefer shared build type imports)
- Patch 169: `docs/patches/patch_169.md` (PR-8 Stage 3: type drift guardrails)
- Patch 168: `docs/patches/patch_168.md` (PR-8 Stage 2: unify project/context types via shared types)
- Patch 167: `docs/patches/patch_167.md` (PR-8 Stage 1: unify build types)
- Patch 166: `docs/patches/patch_166.md` (PR-8 kickoff: post-PR-7 verification + docs/script cleanup)
- Patch 165: `docs/patches/patch_165.md` (Fix Patch 164 docs + update refactor scripts after facade removal)
- Patch 164: `docs/patches/patch_164.md` (PR-7 Stage 5: remove facades after migration)
- Patch 163: `docs/patches/patch_163.md` (PR-7 Stage 4: enforce facade import bans via ESLint errors)
- Patch 162: `docs/patches/patch_162.md` (PR-7 Stage 3.1: tighten facade audit + fix remaining imports)
- Patch 161: `docs/patches/patch_161.md` (PR-7 Stage 3: deprecate facades + add audit script)
- Patch 160: `docs/patches/patch_160.md` (PR-7 Stage 2: migrate internal imports away from facades)
- Patch 159: `docs/patches/patch_159.md` (PR-7 Stage 1: warn-only lint guardrails for facade imports)

- Patch 158: `docs/patches/patch_158.md` (PR-6 Stage 4: move runner into diagnostics; templateChecklist as thin facade)
- Patch 157: `docs/patches/patch_157.md` (PR-6 Stage 3: extract patchers + defaults into modules)
- Patch 156: `docs/patches/patch_156.md` (PR-6 Stage 2: templates barrel exports)
- Patch 155.1: `docs/patches/patch_155_1.md` (Hotfix: TypeScript types for PR-6 Stage 1)
- Patch 155: `docs/patches/patch_155.md` (PR-6 Stage 1: template checklist modularization)

- Patch 154.1: `docs/patches/patch_154_1.md` (Hotfix: remove duplicate useBuildStatus import)
- Patch 154: `docs/patches/patch_154.md` (PR-5 Stage 3: polling out of ProjectContext)
- Patch 153: `docs/patches/patch_153.md` (PR-5 Stage 2: archive + build trigger services)
- Patch 152: `docs/patches/patch_152.md` (PR-5 Stage 1: template loader + file mutations)

- Patch 151: `docs/patches/patch_151.md` (PR-4 Stage 2: GitHub infra split into modules)
- Patch 150: `docs/patches/patch_150.md` (PR-4 Stage 1: GitHub service moved to infra; contexts facade)
- Patch 149: `docs/patches/patch_149.md` (PR-3: polling extract + single poller)
- Patch 148: `docs/patches/patch_148.md` (PR-2: storage move + facade)
- Patch 147: `docs/patches/patch_147.md` (V3.1 scaffolding)
