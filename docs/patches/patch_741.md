# Patch 741 — MD-Review-/Sync nach Test-User-Cleanup-Status

## Ziel
Die kanonischen MD-Dateien nach abgeschlossenem externem Supabase-Test-User-Cleanup synchron halten, ohne Repo-Code oder Live-Mutationen zu aendern.

## Umgesetzt
- Stand-/Patch-Header auf **Patch 741** vereinheitlicht in den Kern-MDs (`README.md`, `docs/INDEX.md`, `docs/TESTING_GUIDE.md`, `docs/FRESH_CHECKOUT_GREEN_PATH.md`, `docs/TODO.md`, `docs/reviews/Review.md`).
- Externe Restpunktlage praezisiert:
  - Test-User-Cleanup (`h91874350@gmail.com` / `BlauBeerToni84`) als erledigt dokumentiert.
  - `diagnostics_reports` bleibt bewusst offene Produktentscheidung (kein Blindumbau).
- Checklog + Root-Patchlog um den Durchlauf ergaenzt.

## Validierung
```bash
node scripts/docsLint.js
node scripts/check_docs_contracts.js
bash scripts/check_patch_docs_sync.sh
```

## Nicht-Ziele
- Keine Repo-Codeaenderungen
- Keine Supabase-Live-Mutationen
- Keine Aenderung an `diagnostics_reports`
