# Patch 551

## Ziel
Verbleibende stale Modell-/Default-Referenzen in den Summary-Dokumenten nach den bereits gemergten Runtime-/Katalog-Aenderungen korrigieren (ohne erneuten Runtime- oder Katalog-Umbau).

## Gefundene Rest-Drift
- README, Checklog und Patchlog enthielten noch einen zwischenzeitlichen Textstand mit `gpt-5-mini`/`gpt-4.1-nano` als scheinbar aktuellem Katalog.
- Die historische Notiz `patch_429.md` konnte ohne Zusatzkontext so gelesen werden, als waeren dortige Defaults weiterhin aktuell.

## Umsetzung
- `README.md`: aktueller Standtext auf die reale Modell-/Default-SoT korrigiert; Abschlussmarker auf Patch 551 gesetzt.
- `PROJECT_CHECKLOG.md`: neuen Patch-551-Eintrag ergaenzt und den alten Patch-549-Text als historisch (nicht mehr aktueller SoT-Stand) praezisiert.
- `docs/patches/PATCHLOG_ROOT.md`: neuen Patch-551-Eintrag ergaenzt und den Patch-549-Root-Summarytext auf historischen Zwischenstand eingeordnet.
- `docs/patches/patch_429.md`: expliziten Historie-Hinweis ergaenzt, der auf die aktuelle Modell-/Default-SoT verweist.

## Validierung
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `git diff --check`
