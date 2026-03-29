# Patch 610

## Anlass
Im PR-uebergreifenden Merge-Readiness-Review fuer Patch 605-609 war der Endvertrag inhaltlich konsistent, jedoch blieb eine kleine Doku-Drift bestehen:

- `docs/EDGE_FUNCTIONS_STATUS.md` zeigte im Header noch `Stand: 2026-03-29 (Patch 608)`,
- obwohl derselbe Stand bereits die Patch-609-Aussagen (Legacy-Sunset) enthielt.

## Umsetzung
- Header in `docs/EDGE_FUNCTIONS_STATUS.md` auf `Stand: 2026-03-29 (Patch 609)` korrigiert.
- Keine Aenderung an Runtime-/Auth-/CI-Vertraegen, nur Doku-Synchronisierung fuer Merge-Readiness.

## Ergebnis
Der Doku-Endzustand zur PR-Kette 480-484 ist jetzt ohne interne Patch-Nummer-Inkonsistenz lesbar.
