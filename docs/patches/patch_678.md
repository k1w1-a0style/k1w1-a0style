# Patch 678 — Refactor-Durchlauf 38 (targeted contract/mock cleanup wave 4)

## Ziel
Den naechsten auth-/fetch-/contract-nahen Test-Debt helper-first reduzieren, ohne Produktcode zu oeffnen.

## Umgesetzt
- `__tests__/auth.failClosedAndDurableRateLimit.test.ts`
  - getypte `fetch`-Spies ohne `"fetch" as any`
- `__tests__/edgeErrorResponseContracts.test.ts`
  - `JsonRecord`-Reader statt `Promise<any>`
- `__tests__/githubFiles.contracts.test.ts`
  - keine `response(...) as any`-Rueckgaben mehr
- `__tests__/bridgeValidation.test.ts`
  - lokale Restcasts helper-first auf `unknown`-/Record-Narrowing reduziert
- `__tests__/chatHistoryMigration.test.ts`
  - typed AsyncStorage-Mock-Helper statt `AsyncStorage as any`
- neue Helper-Datei:
  - `__tests__/helpers/asyncStorageMockHelpers.ts`

## Validierung
- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`

## Hinweis
Produktcode bleibt unveraendert; der verbleibende `any`-Debt sitzt weiter fast ausschliesslich in Tests/Mocks/Fixtures sowie Historien-/Doku-Treffern.
