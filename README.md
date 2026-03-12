# k1w1-a0style

## Schnellstart Doku
- Einstieg: `docs/INDEX.md`
- Laufende Restliste: `docs/TODO.md`
- Laufendes Checklog: `PROJECT_CHECKLOG.md`
- Patch-Index (append-only): `docs/patches/PATCHLOG_ROOT.md`
- Patch-Workflow: `docs/WORKFLOW_PATCHING.md`

## Aktueller Stand (operativ)
- Zuletzt abgeschlossen: **Patch 419 (MD-/Notes-Cleanup, konservativ)**.
- Repo-/Branch-Auswahl bleibt strikt über `projectData.linkedRepo` / `projectData.linkedBranch` als SoT.
- Vor Workflow-/CI-Patches zuerst Drift-/Contract-Guards ausführen (siehe `docs/WORKFLOW_PATCHING.md`).
- Patch-Referenz für Guard-Invariants: **Patch 415 V3** (shared Admin-/CI-Bearer-Guard auf workflow-/CI-nahen Edge-Pfaden).

## Standard-Checks
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

## Patch-Hinweis (Kurzform)
1. Patch anwenden (`git apply --check` / `git apply`)
2. Standard-Checks ausführen
3. Erst dann committen/pushen
