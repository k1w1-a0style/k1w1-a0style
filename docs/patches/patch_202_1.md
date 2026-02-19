# Patch 202.1 — Fix malformed type-only imports (hotfix)

## Problem
Patch 202 introduced several **broken import blocks** by inserting `import type ...` lines *inside* existing `import { ... }` statements.
That produced TypeScript parse errors like **TS1003/TS1109** and Jest “Unexpected keyword 'import'”.

## Fix
- Hoist all `import type { ... }` lines back to valid top-level imports (outside of any `import { ... }` block).
- Fix one invalid TS syntax in `useFileEditor.ts` (`type SyntaxError as ...` inside a named import list).

## Affected files
- `components/MessageItem.tsx`
- `hooks/useChatAIFlow.ts`
- `hooks/useGitHubRepos.ts`
- `lib/diagnostics/preflightChecks.ts`
- `lib/diagnostics/preflightRunner.ts`
- `project/services/buildStartService.ts`
- `project/services/projectArchiveService.ts`
- `screens/AppStatusScreen/hooks/useAppStatusScreen.ts`
- `screens/ChatScreen/hooks/useChatScreen.ts`
- `screens/CodeScreen/hooks/useFileEditor.ts`
- `screens/CodeScreen/hooks/useFileExplorer.ts`
- `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts`
- `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`

## Expected
`npm run typecheck`, `npm run lint:ci`, `npm run test:silent` all green again.
