# Patch 202.3 — Hotfix: restore missing `ProjectFile` type imports

## Problem
After Patch 202 / 202.1 / 202.2, a few files ended up with an `import type { ProjectFile ... }` line accidentally placed *inside* a leading block comment (`/** ... */`).

That makes the import a comment, so TypeScript can no longer see `ProjectFile`, leading to errors like:
- `TS2304: Cannot find name 'ProjectFile'.`

## Fix
Move the `ProjectFile` type-only imports out of the header comments and into real import statements.

### Files touched
- `lib/fileWriter.ts`
- `utils/chatHeuristics.ts`
- `lib/__tests__/fileWriter.test.ts`

## Notes
This is a surgical compile-only fix (no runtime behavior changes).
