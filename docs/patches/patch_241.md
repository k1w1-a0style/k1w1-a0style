# Patch 241 (2026-02-24)

## Ziel

P2 Hygiene: verbleibende `console.*` Cluster im `infra/` Layer und in `GitHubContext` auf `logger.*` umstellen (Secret-Redaction & einheitliche Logs), plus OpenAI Reasoning-Model Guard zukunftssicher machen.

## Änderungen

### Logger-Sweep (console → logger)

- `contexts/GitHubContext.tsx`
  - 6× `console.error` → `logger.error` (strukturierte Meta-Objekte)

- `infra/storage/projectPersistence.ts`
  - 7× `console.error` → `logger.error`
  - Pfad-Leak im Verzeichnis-Fehlerlog entfernt (kein `dirUri` im Log-String)

- `infra/github/tokenStore.ts`
  - 3× `console.error` → `logger.error` (Key-Name bleibt als Meta, Werte werden nie geloggt)

- `infra/github/repos.ts`
  - `console.warn`/`console.error` → `logger.warn`/`logger.error`

- `infra/github/workflows.ts`
  - `console.warn` → `logger.warn`

### OpenAI Reasoning-Model Guard

- `lib/orchestrator.ts`
  - `isReasoningModel()` erweitert: erkennt jetzt auch versionierte IDs wie `o1-2024-12-17` / `o3-mini-2025-01-31` und zukünftige `oN` Modelle.
  - Implementation: `^o\d` statt hardcodierter `o1/o3` Liste.

## Checks

```bash
npm run test:silent
npm run typecheck
npm run lint:ci
```
