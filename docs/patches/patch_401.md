# Patch 401

## Summary

Patch 401 cleans up the remaining low-risk follow-up items after Patch 400 without touching already-fixed provider logic.

## Included

- Memoize `ProjectContext`, `GitHubContext`, and `TerminalContext` provider values with `useMemo` to reduce avoidable consumer re-renders.
- Extend `__tests__/edgeHelperVisibility.invariants.test.ts` so direct `_shared` imports are covered for `github-run-artifact-json` and `trigger-eas-build`.
- Sync `AGENTS.md` so the current guard-script set is listed in the patch delivery checklist.
- Update patch docs/checklog/readme for Patch 401.

## Explicitly not included

These items were already fixed before this patch and therefore were **not** changed again:

- Gemini `systemInstruction` handling
- Anthropic empty-message fallback

These items were reviewed but intentionally left for a later patch because they are low-priority hardening, not blockers:

- adding `rateLimit()` to disabled/admin-only edge functions
- wrapping every disabled edge function in new top-level `try/catch` blocks

## Validation

Run after applying:

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
