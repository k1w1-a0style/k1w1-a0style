# Patch 406

Datum: 2026-03-08

## Inhalt
- Neuer Guard `scripts/check_workflow_edge_contracts.sh` prüft die operativen Verträge zwischen Workflows und Edge-Functions.
- Neue Doku `docs/EDGE_FUNCTIONS_STATUS.md` dokumentiert aktive workflow-relevante Edge-Functions und bewusst deaktivierte Legacy-Funktionen.
- `docs/INDEX.md` verlinkt die neue Edge-Functions-Statusseite.
- `.github/workflows/README.md` dokumentiert den zusätzlichen Workflow↔Edge-Vertragscheck.
- Neuer Repo-Invariant-Test `__tests__/patch406.workflowEdgeContracts.invariants.test.ts` prüft die wichtigsten Vertragsanker zusätzlich auf Testebene.
- `workflow-lint.yml` führt die neuen Guard-Skripte jetzt ebenfalls in CI aus.
- Trigger-Pfade von `workflow-lint.yml` decken jetzt auch Guard-Skripte, `docs/WORKFLOW_PATCHING.md` und die neue Edge-/Patch-Doku ab, damit diese Änderungen CI nicht still umgehen. Doppelte Path-Einträge wurden dabei entfernt. Zusätzlich ist die `actionlint`-CLI dort versionsgepinnt, und das Installer-Script wird versionsgebunden statt von `main` geladen.
- Patch-/README-Doku auf Patch 406 gehoben.

## Ziel
Die restlichen offenen Nicht-Blocker aus dem Deep-Review schließen:
- Workflow↔Edge-Verträge explizit absichern
- Betriebsdoku für aktive vs. deaktivierte Edge-Functions bereitstellen
- Docs-Index und Patch-Doku sauber synchron halten
