# Patch 721 - Persistenz-Scope in Settings explizit gelabelt

## Kontext

Der offene Verbesserungspunkt "Persistenz-Scope klar im UI labeln" wurde umgesetzt, damit Nutzer explizit sehen, dass kein globales projektuebergreifendes Chat-Gedächtnis aktiv ist.

## Aenderungen

1. `PrivacySection` zeigt jetzt einen expliziten Scope-Hinweis:
   - `Scope: pro Projekt (kein globales, projektübergreifendes Gedächtnis).`
2. Neue Regression `__tests__/privacySection.scopeLabel.test.tsx` prüft die sichtbaren Scope-Texte.
3. `docs/TODO.md` markiert den Persistenz-Scope-Punkt als erledigt (Patch 721).

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/privacySection.scopeLabel.test.tsx`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
