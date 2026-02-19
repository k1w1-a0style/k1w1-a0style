# Patch 202: Shim-Abbau (Imports auf shared/types/* umstellen)

## Ziel
- Imports, die bisher aus `contexts/types` (Compatibility-Shim) kamen, werden direkt auf die echten Quellen in `shared/types/*` umgestellt.
- Keine Laufzeit-Änderungen: nur `import type` Umstellungen.

## Änderungen
- Ersetzt `import type { ... } from ".../contexts/types"` durch:
  - `shared/types/project` für `ProjectFile`, `TemplateId`, `CoreTemplateId`, `ProjectData`, `AutoFixRequest`, `LastPreviewMeta`
  - `shared/types/chat` für `ChatMessage`
  - `shared/types/build` für `BuildStatus` / build-type exports

## Hinweis
- `contexts/types.ts` bleibt bestehen (deprecated seit Patch 201), aber neue Nutzung soll vermieden werden.
