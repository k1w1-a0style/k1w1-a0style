# Patch 642 - Refactor Durchlauf 4 (Connections Precheck helper-first)

## Ziel
- Nächsten kleinen, sicheren Refactor-Schritt im Connections-Hotspot umsetzen.
- Frühzeitige EAS-Test-Entscheidung aus dem Hook in pure Helper-Logik verlagern.

## Umgesetzt
- Neuer Helper `resolveEasTestPrecheck(...)` in `useConnectionsScreenHelpers.ts`.
- `useConnectionsScreen.ts::testEas` nutzt den Helper für die frühen missing-/unknown-Pfade inklusive Alert-Text.
- Flow/Verträge unverändert; nur Inline-Branching reduziert.
- Tests erweitert (`__tests__/useConnectionsScreenHelpers.test.ts`).

## Verifikation
```bash
npm run test:silent -- --runInBand __tests__/useConnectionsScreenHelpers.test.ts __tests__/connectionsScreen.screen.test.tsx __tests__/connectionsScreen.validation.test.ts
npm run typecheck
npm run lint:ci
npm run test:silent
git diff --check
bash scripts/check_patch_docs_sync.sh
```
