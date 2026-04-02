# Patch 658 — Refactor-Durchlauf 19 (Import/Export typing helper-first)

## Ziel

Kleinen produktionsnahen Typing-Rest in `screens/AppInfoScreen/hooks/importExportHelpers.ts` schliessen, ohne Import-/Export-/Backup-Vertragsaenderung.

## Umgesetzt

- neuer pure Helper `screens/AppInfoScreen/hooks/importExportErrorHelpers.ts`
  - `getImportExportErrorMessage(...)`
  - `isImportExportAborted(...)`
- `screens/AppInfoScreen/hooks/importExportHelpers.ts`
  - alle `catch (error: any)` auf `catch (error: unknown)` umgestellt
  - konservative Abbrucherkennung + Fehlermeldungs-Fallback zentralisiert
- neuer fokussierter Test `__tests__/importExportErrorHelpers.test.ts`

## Bewusst nicht in diesem Patch

- kein Umbau der eigentlichen Import-/Export-/Sharing-Orchestrierung
- kein breiter AppInfo-Refactor
- kein `jsonUtils`-Rueckgabe-/Caller-Umbau (eigener naechster Durchlauf)

## Verifikation

- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`

Hinweis: Voller `typecheck`/`lint:ci`/`test:silent` ist im gelieferten ZIP ohne installierte Abhaengigkeiten nicht belastbar reproduzierbar.
