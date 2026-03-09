# k1w1-a0style

## Docs & Workflow

- Einstieg: `docs/INDEX.md`
- Offene Punkte: `docs/TODO.md`
- Patch-Ablauf: `docs/WORKFLOW_PATCHING.md`
- Projekt-Roadmap (gröber): `docs/PROJECT_TODO.md`
- Patchlog (append-only): `docs/patches/PATCHLOG_ROOT.md`
- Checklog (laufend, kurz): `PROJECT_CHECKLOG.md`

## Aktueller Patch-Stand
- Zuletzt abgeschlossen: **Patch 408**
- Workflow-/CI-Lite-SoT ist nach 393A–406 konsolidiert
- Patch 407 V3 härtet die Repo-/Branch-SoT für Connections/EAS-Prep-Flows: projektgebundene Auswahl gewinnt als Paar, gemeinsame Auflösung über `lib/selection/repoBranch.ts`, kein stiller `main`-Fallback dort, doppelte Spiegelung in `App.tsx` entfernt
- Patch 408 V5 glättet den Build-Job-ID-Vertrag auf die aktuelle `build_jobs`-Realität: positive numerische IDs statt UUID-Annahme, App-/Edge-Normalisierung für Number→String, ehrliche Docs + Regressionstests
- Vor dem nächsten Workflow-Patch immer zuerst: `bash scripts/check_workflow_template_drift.sh`
- Für Workflow↔Edge-Verträge zusätzlich: `bash scripts/check_workflow_edge_contracts.sh` (wird ab Patch 406 V4 auch in `workflow-lint.yml` erzwungen)
- Trigger-Abdeckung für die Guard-/Docs-Dateien ist ab Patch 406 in `workflow-lint.yml` enthalten (inkl. `docs/WORKFLOW_PATCHING.md`, ohne doppelte Path-Einträge); zusätzlich ist `actionlint` dort versionsgepinnt und das Installer-Script versionsgebunden geladen

## Patch-Hinweis
Bei Patch-ZIPs immer:
1. ZIP ins Projektroot legen
2. entpacken
3. ZIP direkt wieder löschen
4. Patch anwenden
5. `typecheck`, `lint:ci`, `test:silent`
6. erst dann commit + push
