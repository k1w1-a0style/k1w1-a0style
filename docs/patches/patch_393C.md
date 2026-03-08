# Patch 393C

## Ziel

Patch 393C schließt die 393er Serie mit **Doku- und Patch-Disziplin** ab. Nach den technischen Änderungen aus 393A und 393B werden hier die Repo-Statusangaben, Patch-Anweisungen und Guard-Regeln auf einen konsistenten Stand gebracht.

## Enthalten

- `README.md`
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/WORKFLOW_PATCHING.md`
- `docs/patches/patch_393C.md`
- `scripts/check_patch_docs_sync.sh`

## Änderungen

1. **README synchronisiert**
   - aktueller Repo-Stand auf Patch 393C gesetzt
   - Patch-Statusbereich auf `Zuletzt: Patch 393C` / `Nächster: TBD` vereinheitlicht
   - Verweis auf diese Patchnote ergänzt

2. **Checklog und Patchlog ergänzt**
   - Patch 393C in `PROJECT_CHECKLOG.md`
   - Patch 393C als oberster Eintrag in `docs/patches/PATCHLOG_ROOT.md`

3. **Patch-Ablauf dokumentiert**
   - `docs/WORKFLOW_PATCHING.md` beschreibt jetzt den vollständigen Standardablauf:
     - alten entpackten Patch-Ordner entfernen
     - ZIP entpacken
     - Apply-Script ausführen
     - entpackten Patch-Ordner entfernen
     - ZIP optional erst danach löschen
   - Guard-Scripts werden explizit vor den Standard-Checks erwähnt

4. **Guard-Script ergänzt**
   - `scripts/check_patch_docs_sync.sh` prüft die Kern-Konsistenz für 393C:
     - README-Status
     - Patchlog-Index
     - Checklog-Eintrag
     - Existenz der Patchnote
     - aktualisierte Patch-Anleitung

## Erwarteter Effekt

- Kein widersprüchlicher Patch-Status mehr in den zentralen MD-Dateien.
- Patch-ZIP-Ablauf ist im Repo klarer beschrieben.
- Künftige Doku-Drift in den zentralen Patch-Dateien fällt schneller auf.

## Validierung

```bash
bash scripts/check_patch_docs_sync.sh
npm run typecheck
npm run lint:ci
npm run test:silent
```

## Commit-Vorschlag

```bash
git add .
git commit -m "patch: sync patch docs/checklog and tighten patch package workflow instructions (patch 393C)"
git push origin codex
```
