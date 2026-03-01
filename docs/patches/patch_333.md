# Patch 333: AbortError-Handling für Objekt-Rejections in BuildPolling

## Ziel
Review-Fund aus PR #171 beheben: `fetchWithTimeout` soll Timeout-Fehler weiterhin korrekt normalisieren, auch wenn `fetch` statt eines `Error`-Objekts nur ein Plain-Object mit `{ name: "AbortError" }` wirft.

## Änderungen

### 1) AbortError-Erkennung wieder shape-basiert ergänzt
- Datei: `project/services/buildPollingService.ts`
- In `fetchWithTimeout` wird im `catch` jetzt ein robuster `errorName` ermittelt:
  - `Error`-Instanzen via `error.name`
  - Objekt-Rejections via `'name' in error`
- Bei `AbortError` wird weiterhin konsistent
  `Request timeout - Keine Antwort vom Server`
  geworfen.

### 2) Regressionstest für Objekt-AbortError ergänzt
- Datei: `__tests__/buildPollingService.test.ts`
- Neuer Testfall stellt sicher, dass auch `throw { name: "AbortError" }` als Timeout normalisiert wird.

## Warum sicher
- Kein API-Signatur-Change.
- Nur Fehlerpfad-Härtung im Timeout-Fall.
- Verhindert Rückfall auf generische Fehlermeldung in aufrufenden Hooks/Flows.

## Validierung
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
