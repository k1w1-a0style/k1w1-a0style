# k1w1-a0style

## Docs & Workflow

- Einstieg: `docs/INDEX.md`
- Offene Punkte: `docs/TODO.md`
- Patch-Ablauf: `docs/WORKFLOW_PATCHING.md`
- Projekt-Roadmap (gröber): `docs/PROJECT_TODO.md`
- Patchlog (append-only): `docs/patches/PATCHLOG_ROOT.md`
- Checklog (laufend, kurz): `PROJECT_CHECKLOG.md`

## Aktueller Patch-Stand
- Zuletzt abgeschlossen: **Patch 399**
- Workflow-/CI-Lite-SoT ist nach 393A–399 konsolidiert
- Vor dem nächsten Workflow-Patch immer zuerst: `bash scripts/check_workflow_template_drift.sh`

## Patch-Hinweis
Bei Patch-ZIPs immer:
1. ZIP ins Projektroot legen
2. entpacken
3. ZIP direkt wieder löschen
4. Patch anwenden
5. `typecheck`, `lint:ci`, `test:silent`
6. erst dann commit + push
