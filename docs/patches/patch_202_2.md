# Patch 202.2 — Fix broken `import type` blocks (TypeScript parse errors)

## What
Patch 202 introduced several malformed import sections (an `import type { … }` line got inserted *inside* other import blocks). This caused TypeScript/Jest to fail with errors like **“Identifier expected”** / **“Unexpected keyword 'import'”**.

## Fix
This patch **overwrites** the affected files with corrected import sections:

- `lib/diagnostics/preflightChecks.ts`
- `lib/diagnostics/preflightRunner.ts`
- `screens/AppStatusScreen/hooks/useAppStatusScreen.ts`
- `screens/ChatScreen/hooks/useChatScreen.ts`
- `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts`
- `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`

All type-only imports now use `import type …` from `shared/types/*` (as intended by Patch 202), without breaking other imports.

## Commands
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
