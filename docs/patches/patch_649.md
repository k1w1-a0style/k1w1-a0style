# Patch 649 - Refactor Durchlauf 11 (Connections Link-Selection Precheck helper-first)

## Ziel
- Naechsten kleinen, sicheren Refactor-Schritt im Connections-Hotspot umsetzen.
- Fruehe Link-Existing-Selection-Guards aus dem Hook in einen reinen Helper verlagern.

## Umgesetzt
- Neuer Helper `resolveLinkExistingSelectionPrecheck(...)` in `useConnectionsScreenHelpers.ts`.
- `useConnectionsScreen.ts::onLinkExisting` nutzt den Helper statt lokaler Inline-Checks fuer Token/Repo/Branch-Alert-Entscheidungen.
- Keine API-/Dispatch-/Auth-/Persistenz-Flow-Aenderung; nur Guard-Mapping zentralisiert.
- Tests erweitert (`__tests__/useConnectionsScreenHelpers.test.ts`) fuer missing token/repo/branch und ok-Fall.

## Verifikation
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
bash scripts/check_patch_docs_sync.sh
```
