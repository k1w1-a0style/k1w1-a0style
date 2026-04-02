# Patch 690 — Docs/History Compaction

## Ziel

Die Kernhistorie sollte im `README.md` nicht erneut dieselben langen Patch-Bloecke wiederholen,
sondern das README wieder klar als Einstiegs-/Statusdokument lesbar halten. Die append-only
Historie bleibt in `docs/patches/PATCHLOG_ROOT.md` und `PROJECT_CHECKLOG.md` erhalten.

## Umsetzung

- `README.md`
  - den Abschnitt `Aktueller Stand (kompakt)` auf eine ehrliche Kurzfassung reduziert
  - den doppelten/ueberlappenden zweiten Historienblock entfernt
  - klaren Verweis auf Patchlog + Checklog fuer die vollstaendige Historie ergaenzt
- Kern-MDs auf denselben Patchstand gezogen:
  - `docs/INDEX.md`
  - `docs/TESTING_GUIDE.md`
  - `docs/FRESH_CHECKOUT_GREEN_PATH.md`
  - `docs/TODO.md`
- `docs/04-risk-hotspots.md` um einen kleinen SoT-/Lesbarkeits-Nachtrag fuer Patch 690 erweitert
- `PROJECT_CHECKLOG.md` und `docs/patches/PATCHLOG_ROOT.md` append-only fortgeschrieben

## Nicht gemacht

- keine Produktcode-Aenderung
- keine Testcode-Aenderung
- keine Umsortierung oder Loeschung der append-only Historie in Patchlog/Checklog

## Validation

- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`
