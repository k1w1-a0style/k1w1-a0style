# Patch 478 — Schritt 2 Restpunkt-Prüfung: Gemini-Key-Transport konservativ gehärtet

## Was wurde geändert?

- `lib/orchestrator/providers/gemini.ts`: Gemini-Requests senden den API-Key nicht mehr als URL-Query-Parameter, sondern per `x-goog-api-key` Header.
- `lib/__tests__/geminiProvider.test.ts`: gezielte Regression ergänzt, die den Header-Pfad absichert und verhindert, dass `?key=` zurückkehrt.

## Bewertung der geprüften Restpunkte

- **NEW-12**: bestätigt und klein lösbar → konservativ behoben.
- **NEW-3**: `new Function()` in `lib/sandpackBuilder.ts` bleibt ein echter Architektur-/Isolations-Trade-off für die lokale Preview-Ausführung von Projektcode; kein kleiner, sauberer Ersatz ohne größeren Umbau.
- **NEW-6**: im App-/RN-Laufzeitcode nicht bestätigt; Treffer nur in Test-Helfern zur temporären Env-Simulation.
- **NEW-7**: pauschaler Migrationsmangel nicht bestätigt; sicherheits-/zustandskritische Schlüssel haben bereits Legacy-Fallback/Migration, viele übrige Keys sind Soft-State/Prefs.
- **NEW-5**: im aktuellen Stand nicht bestätigt; `types/preview.ts` beschreibt den tatsächlichen Root-Stack für die Preview-Navigation korrekt.

## Verifikation

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand lib/__tests__/geminiProvider.test.ts`
