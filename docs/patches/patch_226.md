# Patch 226: Logger sweep (core runtime)

## Ziel
- Weniger `console.log` Spam in Production-Code.
- Einheitliches Logging über `lib/logger.ts`.
- Dev-only Logs dort, wo es extrem chatty ist.

## Änderungen
### 1) GitHub Repo Pull
**Datei:** `hooks/useGitHubRepos.ts`
- Binary-Dateien werden weiterhin geskippt, aber Log nur noch in `__DEV__`.
- `console.log` → `logger.debug`.

### 2) GitHub Push (Repo Files)
**Datei:** `infra/github/files.ts`
- `console.log/console.warn` → `logger.info/logger.warn/logger.debug`
- Keine Functional Changes am Push-Flow.

### 3) Project Persistence / ZIP Import
**Datei:** `infra/storage/projectPersistence.ts`
- `console.log/console.warn` → `logger.info/logger.warn`
- Verhalten unverändert, nur Logging konsistent.

## Checks
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

## Hotfix 226.2

**Fix:** `hooks/useGitHubRepos.ts` hatte ein kaputtes Import-Block-Format (TS/Jest Parser Error). Import-Block ist wieder syntaktisch korrekt.
