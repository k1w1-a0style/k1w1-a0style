# Patch 628 — `as any`-Abbau (Durchlauf 2, A-Hotspots)

## Ziel
Naechste kleine, sichere Runde fuer produktionsnahe `as any`-Reste ohne Broad-Refactor.

## Umgesetzt
1. `lib/notificationService.ts`
   - `Constants as any` entfernt.
   - Zugriff jetzt via `Record<string, unknown>` + enge Objekt-Narrowings in `getConstantsSource()` und `resolveProjectId()`.

2. `supabase/functions/github-workflow-logs/index.ts`
   - `e as any` im Catch-Block entfernt.
   - Neuer `asErrorLike(...)`-Narrowing-Helper fuer `status/body/code/message/notReady`.

3. `supabase/functions/create_codesandbox/helpers.ts`
   - `(err as any).message` in `safeErrorMessage(...)` entfernt.
   - Zugriff direkt ueber `"message" in err`-Guard.

## Inventar
- Codefokussierter Scan (ohne `docs/**` und `README.md`):
  - Vorher: 212
  - Nachher: 208
  - Netto: **-4 `as any`**

## Verifikation
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `npm run test:silent -- --runInBand k1w1Handler.providers.invariants.test.ts`
- `git diff --check`
