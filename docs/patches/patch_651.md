# Patch 651 - Refactor Durchlauf 13 (Connections EAS-Link Start-Message helper-first)

## Ziel
- Naechsten kleinen, sicheren Refactor-Schritt im Connections-Hotspot umsetzen.
- EAS-Link-Startmessage-Auswahl aus dem Hook in einen reinen Helper verlagern.

## Umgesetzt
- Neuer Helper `resolveEasLinkWorkflowStartMessage(...)` in `useConnectionsScreenHelpers.ts`.
- `useConnectionsScreen.ts` nutzt den Helper statt lokaler inline Text-Verzweigung fuer `projectId`-vs-Init-Hinweis.
- Keine API-/Dispatch-/Auth-/Persistenz-Flow-Aenderung; nur Message-Mapping zentralisiert.
- Tests erweitert (`__tests__/useConnectionsScreenHelpers.test.ts`) fuer beide Startmessage-Pfade.

## Verifikation
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
bash scripts/check_patch_docs_sync.sh
```
