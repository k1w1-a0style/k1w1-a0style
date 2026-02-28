# Patch 321: Preview Observability (`meta.debug`) + TODO-Sync

## Kontext
Aus der offenen Fix-Liste blieb der Punkt „Observability: Edge Function Logs + optionales `meta.debug` (minimal)" übrig.

## Änderungen
- `hooks/usePreview.ts`
  - Beim Aufruf von `save_preview` wird `meta.debug` mitgesendet:
    - `source: "usePreview"`
    - `fileCount`
    - `dependencyCount`
  - Ziel: bessere Korrelation in Edge-Logs ohne sensible Inhalte.
- `docs/PROJECT_TODO.md`
  - Observability-Punkt als erledigt markiert.
- `PROJECT_CHECKLOG.md`
  - Patch 321 Eintrag ergänzt.
- `docs/patches/PATCHLOG_ROOT.md`
  - Root-Patchlog um Patch 321 ergänzt.

## Ergebnis
- Minimales, nicht-invasives Observability-Signal für Preview-Requests ist vorhanden.
- Die offene Fix-Liste wurde weiter reduziert.
