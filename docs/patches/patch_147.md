# Patch 147 (V3.1 scaffolding)

## Included
- Add `shared/types/*` (scaffolding only)
- Add refactor docs under `docs/refactor/*`
- Add helper scripts under `scripts/refactor/*`
- Update `.gitignore` to ignore refactor baseline outputs

## Not included (still todo)
- Storage move/facade (PR-2)
- Polling extraction (PR-3)
- GitHub infra split (PR-4)
- ProjectContext split (PR-5)
- Diagnostics split (PR-6)

## Verification
Run:
- npm run typecheck
- npm run lint:ci
- npm run test:silent
