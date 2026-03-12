# k1w1-a0style

## Docs & Workflow

- Einstieg: `docs/INDEX.md`
- Offene Punkte: `docs/TODO.md`
- Patch-Ablauf: `docs/WORKFLOW_PATCHING.md`
- Projekt-Roadmap (gröber): `docs/PROJECT_TODO.md`
- Patchlog (append-only): `docs/patches/PATCHLOG_ROOT.md`
- Checklog (laufend, kurz): `PROJECT_CHECKLOG.md`

## Aktueller Patch-Stand
- Zuletzt abgeschlossen: **Patch 416**
- Workflow-/CI-Lite-SoT ist nach 393A–406 konsolidiert
- Patch 407 V3 härtet die Repo-/Branch-SoT für Connections/EAS-Prep-Flows: projektgebundene Auswahl gewinnt als Paar, gemeinsame Auflösung über `lib/selection/repoBranch.ts`, kein stiller `main`-Fallback dort, doppelte Spiegelung in `App.tsx` entfernt
- Patch 408 V5 glättet den Build-Job-ID-Vertrag auf die aktuelle `build_jobs`-Realität: positive numerische IDs statt UUID-Annahme, App-/Edge-Normalisierung für Number→String, ehrliche Docs + Regressionstests
- Patch 409 V6 glättet den Diagnostics-Upload-/RPC-Vertrag: Upload-ID im Client nur noch als opaque string, SQL-RPC zurück auf die reale bigint-backed `diagnostic_uploads`-Tabelle, TODO/README/Patchlog/Checklog synchron
- Patch 410 final trennt Edge-Function-Admin-Auth sauber vom serverseitigen Service-Role-Lookup, führt einen expliziten CI-Service-Role-Bearer-Guard ein und dokumentiert die offenen Client-Containment-Reste in TODO/Checklog/Patchlog
- Patch 410B entfernt den Supabase Service-Role-Key aus App-/Backup-/Connections-/Secret-Sync-Pfaden, lässt GitHub-/CI-Secrets bewusst unangetastet und ergänzt Guard-Tests gegen erneuten Client-Drift
- Patch 411 V7 härtet den Supabase-Deploy-/DB-Migrations-Workflow auf workflow_dispatch mit explizitem ref, blockt _shared/unsaubere Single-Function-Deploys, ergänzt apply_migrations + Deploy-Metadaten und sichert das Ganze mit Guard-Script + Invariant-Test ab
- Patch 412 härtet privilegierte Supabase-DB-Funktionen weiter: `_diagnostic_upload_guard()` bekommt einen expliziten `search_path`, `PUBLIC`-Execute-Rechte werden von Security-Definer-/CI-Helfern entzogen, und Guard-Script + Invariant-Test sichern den Vertrag gegen Drift ab
- Patch 413 entfernt die restlichen stillen Repo-/Branch-Fallbacks in Build-/Repo-/Diagnostics-/Diff-/CI-Lite-Pfaden und ergänzt Regression-Coverage gegen stilles Repo/Branch-Erfinden
- Patch 414 V13 vervollständigt die Invariant-Coverage für die explizite Ref-SoT: robuste Extraktion plus Dekodierung der eingebetteten Workflow-Templates, stabile Prüfung aller relevanten ref-Input-Blöcke in EAS-Live-/Template-Workflows per Zeilen-/Indent-Scanner, unveränderte Live-/Template-Verträge aus V7 und dokumentierte branch-basierte CI-Lite-Chain als bewusste Ausnahme
- Patch 415 V3 richtet workflow-/CI-nahe Edge-Funktionen auf einen gemeinsamen Admin-/CI-Bearer-Guard aus, lässt Wizard-/Keystore-Setup-Pfade bewusst admin-only und synchronisiert Guard-Script + Invariant-Coverage dafür
- Patch 416 deaktiviert die absichtlich stillgelegten Legacy-Lint-/Native-Sync-Edge-Funktionen auch in `supabase/config.toml`, hält ihre 410-Stubs als explizite Legacy-Failsafes fest und ergänzt Guard-/Invariant-Coverage gegen erneuten Deploy-Drift
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
