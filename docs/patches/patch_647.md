# Patch 647 - Refactor Durchlauf 9 (Connections Status-Flags helper-first)

## Ziel
- Naechsten kleinen, sicheren Refactor-Schritt im Connections-Hotspot umsetzen.
- Connection-Status-Flag-Ableitung aus dem Hook in einen reinen Helper verlagern.

## Umgesetzt
- Neuer Helper `resolveConnectionsStatusFlags(...)` in `useConnectionsScreenHelpers.ts`.
- `useConnectionsScreen.ts` nutzt den Helper statt lokaler inline Ableitung fuer `gh`/`ex`/`edge`/`sbUrl`/`sbAnon`/`linked`/`eas`.
- Keine Save-/Test-/Auth-/API-Flow-Aenderung; nur Status-Mapping zentralisiert.
- Tests erweitert (`__tests__/useConnectionsScreenHelpers.test.ts`) fuer den Status-Flags-Resolver.

## Verifikation
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
bash scripts/check_patch_docs_sync.sh
```
