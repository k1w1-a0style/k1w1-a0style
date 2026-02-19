# Patch 209: migrate ProjectContext off shared-type re-exports

## Goal
Reduce drift by importing shared types directly from `shared/types/*` instead of via `contexts/types.ts`.

## Changes
- **contexts/ProjectContext.tsx**
  - Replace shared-type imports from `./types` with direct imports:
    - `ChatMessage` from `shared/types/chat`
    - `BuildHistoryEntry` from `shared/types/build`
    - `ProjectData`, `ProjectFile`, `TemplateId` from `shared/types/project`
  - Keep `contexts/types.ts` only for **context-local** types (`ProjectContextProps`, `AutoFixRequest`, `LastPreviewMeta`).

- **docs/HANDOFF_NEXT_CHAT.md**
  - Update status notes: `contexts/types.ts` is now effectively a local-types file + deprecated re-exports.

## Why this is safe
No runtime behavior changes — only TypeScript import paths.

