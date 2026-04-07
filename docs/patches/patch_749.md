# Patch 749 — Preview-Legacy-Removal: Query-Secret-Bridge entfernt

## Ziel

Enger Scope fuer den verbliebenen Preview-Legacy-Restpunkt:
- Legacy-`?secret=`-Kompatibilitaet in `preview_page` vollstaendig entfernen
- Header-only Secret-Handoff als alleinigen Pfad erzwingen
- Contract-Test und SoT-Doku auf den finalen Stand synchronisieren

## Umsetzung

1. `supabase/functions/preview_page/index.ts`
   - Query-Secret-Einlesen entfernt (`const querySecret = ...` entfiel)
   - Legacy-Bridge-Renderer `renderLegacyQuerySecretBridgePage` entfernt
   - fehlendes Secret liefert ausserhalb `transport=fragment` nun explizit `Missing preview secret header.`
   - Toggle-URL-SecretHash basiert nur noch auf vorhandenem Header-Secret
2. `__tests__/previewEdgeErrorContract.test.ts`
   - Assertions auf Nicht-Existenz des Legacy-Query-Secret-Pfads umgestellt
   - fail-closed Missing-Header-Meldung explizit abgesichert
3. Doku-Sync
   - `docs/TODO.md`: erledigten Punkt auf Patch-749-Removal umgestellt
   - Header-/Patchstand in Kern-MDs sowie Patchlog/Checklog auf Patch 749 synchronisiert

## Tests / Checks

- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent -- --runInBand __tests__/previewEdgeErrorContract.test.ts`
- `npm run -s docs:lint`
- `npm run -s docs:check:contracts`
- `bash scripts/check_patch_docs_sync.sh`

## Nicht-Ziele

- keine neuen Persistenz-/Recovery-Refactors
- keine Aenderung an Save-Preview-Transport (`transport=fragment` bleibt)
