# Patch 118: preflightChecks TypeScript fix (follow-up to Patch 117)

## Fix
- Use `fileMap.get(path)` because `byPath(files)` returns a `Map<string, ProjectFile>`.
- Correct `mkFix(...)` signature: `mkFix({ label, upserts })`.

## Result
- `npm run typecheck` no longer fails because of the workflow YAML quoting preflight check.
- The Diagnostic screen and preflight runner can load normally in dev and tests.
