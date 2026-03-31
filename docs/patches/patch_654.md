# Patch 654 - Refactor Durchlauf 15 (Connections alert notice helper-first)

## Ziel
- Naechsten kleinen, sicheren helper-first Refactor im Connections-Hotspot umsetzen.
- Alert-/Hinweis-Textpfad aus `useConnectionsScreen.ts` zentralisieren.

## Umgesetzt
- Neuer Helper `resolveConnectionsAlertNotice(...)` in `useConnectionsScreenHelpers.ts`.
- `useConnectionsScreen.ts` nutzt den Helper in den Link/Create-Pfaden (fehlender Token/Repo/Branch, invalides Repo-Format, Start-Hinweis).
- Keine Auth-/Dispatch-/Polling-/Stateflow-Aenderung; nur Text-Mapping zentralisiert.
- Tests erweitert in `__tests__/useConnectionsScreenHelpers.test.ts`.

## Verifikation
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
