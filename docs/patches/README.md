# Patch-Archiv

Stand: **2026-04-02 (Docs Konsolidierung)**

`docs/patches/` ist das **append-only Historienarchiv** des Repos.

## Was hier liegt

- `PATCHLOG_ROOT.md` — laufende Patchhistorie
- `patch_*.md` / `PATCH_*_NOTES.md` — einzelne Patchnotizen
- `checklog/` — alte Checklog-Ergaenzungen
- `manifests/` — historische Patch-Manifeste

## Was dieses Verzeichnis **nicht** ist

- keine aktive Produktdoku
- keine aktuelle TODO-Liste
- keine kanonische Review
- kein Ersatz fuer Runbooks oder den Dokumentations-Index

## Wann du es brauchst

- wenn du nachvollziehen willst, **wann** ein bestimmter Fix oder Refactor passiert ist
- wenn du alte Patches portieren, vergleichen oder auditieren willst

## Wann du es nicht brauchst

- fuer den normalen Einstieg ins Repo
- fuer den aktuellen Produkt-/Betriebsstand
- fuer aktive Restpunkte

Dafuer gelten stattdessen:
- `README.md`
- `docs/INDEX.md`
- `docs/reviews/Review.md`
- `docs/TODO.md`
