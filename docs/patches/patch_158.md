# Patch 158 — PR-6 Stage 4

This patch completes PR-6 by moving the remaining runner (`runTemplateHardChecklist`) out of `lib/templateChecklist.ts` into `lib/diagnostics/templates/*`, keeping the old entrypoint as a thin facade.

## Changes

- Add `lib/diagnostics/templates/runHardChecklist.ts` (new home of `runTemplateHardChecklist`)
- Update `lib/diagnostics/templates/index.ts` to export the runner
- Rewrite `lib/templateChecklist.ts` to re-export types + runner from the diagnostics barrel

No runtime behavior changes intended.

## Verification

Run:

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

Expected: all green.
