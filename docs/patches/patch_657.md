# Patch 657: Edge-Typecheck + File-Result-Semantik-Fallbacks finalisiert

## Ziel

Letzte Restkanten aus Patch 656 sauber abschliessen:

1. `npm run edge:check` wieder grün (konkret `ensureBucketExists(...)` im Keystore-Edge-Pfad).
2. Keine implizite Erfolgsbehandlung für unklare/fehlende Dateiaktions-Resultate.
3. Fallback-Pfade (Batch -> Einzeloperationen) müssen strukturierte Resultat-Semantik erhalten.

## Umsetzung

### 1) Edge-Typecheck-Fix (`android-keystore-generate`)

- In `helpers.ts` wurde die `ensureBucketExists(...)`-Umgebungstypisierung fachlich auf den realen Supabase-Client ausgerichtet:
  - `Awaitable<T> = PromiseLike<T> | Promise<T>`
  - `StorageBucketsQuery` akzeptiert awaitbare `maybeSingle()`-Builder-Rückgaben
  - `StorageBucketCreator` akzeptiert awaitbare `storage.createBucket(...)`-Rückgaben
- `ensureBucketExists(...)` nimmt jetzt `StorageBucketsQuery & StorageBucketCreator` entgegen.

Ergebnis: Der reale Supabase-Client ist typkompatibel; kein Scheinfix mit `any`.

### 2) Dateiaktions-Semantik in UI strikt

- `isMutationSuccess(...)` in `useFileActions` behandelt nur noch `status === "success"` als Erfolg.
- `undefined`/unklare Resultate werden **nicht** mehr als Erfolg gewertet.
- Direkte Folgewirkungen (Selection-Switch, Editor-Clear, Success-Alerts) laufen dadurch nur noch bei belastbarem Erfolg.

### 3) Fallback-Pfad entwertet Resultate nicht mehr

- Beim Ordner-Delete-Fallback (`deleteFiles` fehlt -> Einzel-`deleteFile`) werden Einzelresultate jetzt aggregiert:
  - `error` priorisiert vor `rejected`
  - `success` nur bei mindestens einer echten Änderung
  - sonst `noop`
- Dadurch bleibt die Fachsemantik auch im Adapterpfad erhalten und es gibt keine pauschale Erfolgsannahme.

## Tests / Regressionen

- Neue Invariant für den Edge-Typvertrag:
  - `__tests__/patch657.ensureBucketExists.edgeTypecheck.invariants.test.ts`
- `__tests__/useFileActions.regression.test.tsx` erweitert:
  - kein Selection-Switch bei `undefined`-Resultat
  - Fallback-Ordnerdelete aggregiert Einzelresultate statt Erfolgsannahme

## Ergebnis

- `npm run edge:check` ist grün.
- Dateiaktionen senden in direkt betroffenen UI-/Fallback-Pfaden keine halbwahren Erfolgssignale mehr.
- Strukturierte Resultat-Semantik bleibt auch in Adapter-/Fallback-Pfaden erhalten.
