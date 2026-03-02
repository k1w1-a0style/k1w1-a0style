# Patch 341 (2026-03-02) – Stability Hardening: Open-Handle Guarding + Determinism

## Ziel
- Jest-Lauf stabil halten (keine versteckten Netzwerk-Leaks / offene Timer-Altlasten).
- Zusätzliche Guard-Tests ergänzen, die nicht redundant sind.

## Änderungen
1. **Globaler No-Network Guard in Jest Setup**
   - Datei: `jest.setup.js`
   - `fetch`, `XMLHttpRequest` und `WebSocket` werden standardmäßig geblockt und werfen mit klarer Fehlermeldung.
   - Originale Globals werden in `afterAll` wiederhergestellt.

2. **Neuer Guard-Test: No-Network**
   - Datei: `__tests__/guards.noNetwork.test.ts`
   - Verifiziert, dass ungemockte `fetch`/`XMLHttpRequest`/`WebSocket`-Nutzung in Tests hart fehlschlägt.

3. **Neuer Regressionstest: Patch-Engine Idempotenz**
   - Datei: `__tests__/patchEngine.idempotency.test.ts`
   - Gleicher Patch wird zweimal angewendet; Ergebnis bleibt identisch.

4. **Neuer Stabilitätstest: Diagnostics Determinism**
   - Datei: `__tests__/diagnostics.resultDeterminism.test.ts`
   - Gleiche Fixture, zweimaliger Lauf von `runPreflightChecksAll`, normalisierte Resultate müssen exakt gleich bleiben.

## Verifikation
- `npm run test:silent`
- `npm test -- --runInBand --silent`
- `npm test -- --detectOpenHandles --runInBand --silent`
- `npm run typecheck`
- `npm run lint:ci`

Alle Checks grün.
