# Patch 284: Hotfix – fix truncated refactor files + restore helper exports

## Warum
Patch 283 enthielt mehrere **abgeschnittene Dateien** (fehlende schließende Klammern / kaputte Import-Blöcke). Das hat `tsc` und ESLint direkt gekillt.

## Fixes
- `contexts/AIContext/index.tsx`: fehlendes `};` ergänzt.
- `hooks/useChatAIFlow.ts`, `hooks/useGitHubActionsLogs.ts`, `hooks/usePreview.ts`: fehlendes abschließendes `}` ergänzt.
- `lib/diagnostics/remoteDiagnostics.ts`: fehlendes abschließendes `}` ergänzt.
- `lib/orchestrator/providers/huggingface.ts`: fehlendes `}` ergänzt + Return im `catch` korrekt eingerückt.
- `WorkflowRunDetailModal`:
  - `.styles.ts`: fehlendes `});` ergänzt.
  - `.tsx`: kaputten `import type { ... }` Block repariert.
- `screens/AppStatusScreen/hooks/useAppStatusScreen.ts`: `parseExpoConfig` + `resolveEntryPoint` wieder **re-exported** (Tests erwarten das).
- `utils/chatJsonUtils.ts`: fehlende Imports ergänzt (`jsonrepair`, `log/logError`, `isCodeFile`, `validateProjectFiles`, `ProjectFile`).

## Erwartung
- `npm run typecheck` und `npm run lint:ci` laufen wieder durch.
- Failing Jest-Tests bzgl. `parseExpoConfig/resolveEntryPoint` + `safeJsonParse` sollten wieder grün werden.
