# Patch 456 — Chat-Drift-Digest RN-Runtime Guardrail

## Ziel
Codex-Review-Fund absichern: `buildProjectStateDigest` darf im React-Native-Runtime-Pfad keine Node-Core-Imports (`crypto`) verwenden.

## Umgesetzt
- `lib/chatFlowStateGuards.ts` um eine explizite Runtime-Notiz ergänzt:
  - Datei läuft im App-Runtime-Pfad (`useChatAIFlow`).
  - Node-only Imports (`node:crypto`/`crypto`) sind hier verboten, um Metro-Resolve-Fehler in Mobile-Bundles zu vermeiden.
- Der Hash bleibt bei der bestehenden runtime-sicheren JS-Implementierung (`hashStringRuntimeSafe`), ohne Node-/Browserify-Abhängigkeit.

## Verifikation
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent -- --runInBand __tests__/chatFlowStateGuards.test.ts` ✅
