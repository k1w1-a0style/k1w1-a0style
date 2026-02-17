# Refactoring Plan V3.1 (Patch-oriented)

This is a patchable version of Refactoring Plan V3, designed to avoid duplicate implementations and keep changes small + verifiable.

## How to apply a patch
```bash
unzip -o k1w1-a0style_patch_<N>.zip -d .
rm -f k1w1-a0style_patch_<N>.zip

npm run typecheck
npm run lint:ci
npm run test:silent
```

If everything is green:
```bash
git add -A
git commit -m "Patch <N>: <message>"
git push
```

## PR phases

### PR-0: Baseline & guardrails
- Capture baseline outputs (typecheck / lint / tests)
- Add helper scripts

### PR-1: Shared types + transitional approach
- Add `shared/types/*` as the future source-of-truth
- Keep current code working (no behavior changes)

### PR-2: Storage consolidation (NO rewrite)
- Move `contexts/projectStorage.ts` → `infra/storage/projectPersistence.ts`
- Keep `contexts/projectStorage.ts` as a facade re-export  
✅ Implemented by Patch 148

### PR-3: Polling consolidation (NO parallel poller)
- Extract pure polling functions into `project/services/buildPollingService.ts`
- Keep `hooks/useBuildStatus.ts` as the single hook and call the service  
✅ Implemented by Patch 149

### PR-4: GitHub infra split
- Create `infra/github/*`
- Keep `contexts/githubService.ts` as facade until callers migrated  
✅ Stage 1 implemented by Patch 150  
✅ Stage 2 implemented by Patch 151

### PR-5: ProjectContext slimming
- Move pure domain logic into `project/domain/*`
- Side-effects into `project/services/*`  
✅ Stage 1 implemented by Patch 152  
✅ Stage 2 implemented by Patch 153  
✅ Stage 3 implemented by Patch 154 (+ hotfix 154.1)

### PR-6: Diagnostics + templateChecklist split
- Split `lib/templateChecklist.ts` into modules under `lib/diagnostics/templates/*`
- Keep old entrypoint as facade if needed  
✅ Stage 1 implemented by Patch 155 (+ hotfix 155.1)  
✅ Stage 2 implemented by Patch 156  
✅ Stage 3 implemented by Patch 157  
✅ Stage 4 implemented by Patch 158

### PR-7: Quality / cleanup
- Remove facades when no longer used
- Tighten lint rules
- Keep docs + changelog updated  
✅ Stage 1 implemented by Patch 159  
✅ Stage 2 implemented by Patch 160  
✅ Stage 3 implemented by Patch 161

## Patch index
- Patch 147 — V3.1 scaffolding (shared types + docs + scripts)
- Patch 148 — PR-2: storage move + facade
- Patch 149 — PR-3: polling extract + single poller
- Patch 150 — PR-4 stage 1: GitHub service moved to infra; contexts facade
- Patch 151 — PR-4 stage 2: GitHub infra split into modules; barrel exports
- Patch 152 — PR-5 stage 1: extract template loader + file mutations
- Patch 153 — PR-5 stage 2: extract archive + build trigger services
- Patch 154 — PR-5 stage 3: polling out of ProjectContext
- Patch 154.1 — Hotfix: remove duplicate useBuildStatus import
- Patch 155 — PR-6 stage 1: template checklist modularization
- Patch 155.1 — Hotfix: fix toolchain typing + TemplateFileMap
- Patch 156 — PR-6 stage 2: templates barrel exports
- Patch 157 — PR-6 stage 3: extract patchers/defaults/helpers into modules
- Patch 158 — PR-6 stage 4: move runner into diagnostics; templateChecklist as facade
- Patch 159 — PR-7 stage 1: warn-only lint guardrails for facade imports
- Patch 160 — PR-7 stage 2: migrate internal imports away from facades
- Patch 161 — PR-7 stage 3: deprecate remaining facades + add audit script

- Patch 162: PR-7 Stage 3.1 — tighten facade audit + fix remaining imports
