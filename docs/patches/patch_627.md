# Patch 627 — `as any`-Abbau (Durchlauf 1, runtime-fokussiert)

## Ziel
Konservativer erster Abbau von `as any` mit Fokus auf produktionsnahe Runtime-/Helper-Pfade ohne Vertrags- oder Architekturumbau.

## Umgesetzt
1. **Edge Runtime Payload-Narrowing**
   - `supabase/functions/k1w1-handler/helpers.ts`
   - `parseRequestBody(...)` nutzt jetzt Record-Narrowing statt `body as any`.

2. **Edge Storage-Helper enger typisiert**
   - `supabase/functions/android-keystore-generate/helpers.ts`
   - `ensureBucketExists(...)` entfernt `supabase as any` und verwendet eine kleine, lokale Query-Schnittstelle.

3. **Template-Diagnostics ohne Any-Cast**
   - `lib/diagnostics/templates/patchers/easJson.ts`: `p.defaults as any` entfernt.
   - `lib/diagnostics/templates/runHardChecklist.ts`: Dateiinhalt-Zugriff ohne `(f as any)?.content`.

4. **Projekt-Materialisierung ohne Any-Cast**
   - `lib/projectMaterializer.ts`: Dateiinhalt-Zugriff ohne `(f as any)?.content`.

5. **Repo-Utility ohne Any-Cast**
   - `screens/GitHubReposScreen/utils/repos.ts`: `dedupeReposById` nutzt `r.id` direkt.

## Inventar
- Vorher (Scan): 291
- Nachher (Scan): 285
- Netto: **-6 `as any`**

## Verifikation
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `git diff --check`
- fokussiert: `npm run test:silent -- --runInBand k1w1Handler.providers.invariants.test.ts`

## Spaeterer Review-Follow-up
- **Patch 634 (2026-03-30)** hat fuer denselben Materializer-Pfad einen separaten Runtime-Guard-Fix nachgezogen:
  `materializeProjectFiles(...)` ruft `readProjectFileContent(...)` jetzt erst nach Objekt-Guard auf, damit malformed Hydration-Eintraege weiter fail-safe ignoriert werden.
