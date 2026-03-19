# Patch 484 — NEW-3 kritisch verifiziert, lokaler Preview-Fallback minimal eingehegt

## Was wurde geändert?

- `lib/sandpackBuilder.ts`: Der lokale HTML-Preview-Fallback liefert jetzt zusätzlich eine restriktive Content-Security-Policy aus. Sie blockiert beliebige `fetch`-/XHR-/WebSocket-Verbindungen (`connect-src 'none'`) und begrenzt aktive Skriptquellen auf die ohnehin benötigten Preview-CDNs (`unpkg`, `esm.sh`).
- `lib/__tests__/sandpackBuilder.test.ts`: gezielte Regression ergänzt, die die neue CSP und die weiterhin erlaubten Runtime-Abhängigkeiten des lokalen Preview-Fallbacks absichert.

## Kritische Einordnung

- **NEW-3 bleibt nur teilweise gelöst.** `new Function()` wird weiterhin im lokalen Preview-Fallback verwendet und ist **keine echte Sandbox**.
- Der Ausführungskontext bleibt aber eng begrenzt: Der Code läuft nur im lokal erzeugten WebView-HTML-Fallback der Preview, nicht im normalen App-/Produktivpfad.
- Die neue CSP ist bewusst **kein Blendwerk**: Sie ersetzt keine Isolation, reduziert aber real die triviale Netz-Exfiltration aus diesem Fallback-Kontext.
- Eine vollständige Beseitigung des Restpunkts würde weiterhin einen größeren Architekturumbau erfordern (z. B. echter isolierter Preview-Runner statt `new Function()` im WebView).

## Verifikation

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand lib/__tests__/sandpackBuilder.test.ts`
- `npm run test:silent`
