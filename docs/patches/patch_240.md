# Patch 240 (2026-02-24)

## Ziel
P2-Hygiene & Robustheit: restliche `console.*` in sensiblen Fehlerpfaden auf `logger` umstellen + OpenAI Reasoning-Model-Kompatibilität (o1/o3) absichern.

## Änderungen

### Logger-Hygiene (keine Konsole in Error-Pfaden)
- `contexts/ProjectContext.tsx`
  - 4 verbleibende `console.error(...)` → `logger.error(...)` (ZIP-Export, Text-ZIP-Export, App-Start Load, Background-Save).
- `hooks/useChatAIFlow.ts`
  - `console.warn(...)` → `logger.warn(...)` (Rate-limit Rotation Hinweis, Toast fail, Agent/Validator fail, Explain fail).
- `hooks/usePreview.ts`
  - `console.warn/error(...)` → `logger.warn/error(...)` inkl. strukturierter Meta-Objekte.

### OpenAI Responses API: Reasoning-Model Guard
- `lib/orchestrator.ts`
  - OpenAI Reasoning-Modelle (`o1*`, `o3*`) rejecten `temperature` → Body wird jetzt conditionally gebaut und `temperature` nur gesetzt, wenn es **kein** Reasoning-Modell ist.

### Deprecation Mark
- `contexts/AIContext.tsx`
  - `rotateApiKeyOnError` ist ungenutzt → als `@deprecated` markiert (Nutzung: `SecureKeyManager.rotateKey(provider)` direkt).

## Checks
- `npm run test:silent`
- `npm run typecheck`
