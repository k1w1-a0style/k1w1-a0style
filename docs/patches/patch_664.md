# Patch 664 — Refactor-Durchlauf 24 (productive typing follow-up)

## Ziel

Den naechsten kleinen produktionsnahen Typing-/Error-Contract-Block helper-first nachziehen, ohne Build-/Logs-/Template-Vertraege zu aendern.

## Umsetzung

- `project/services/templateLoader.ts`
  - Template-Dateien werden jetzt ueber sichere Unknown-Reader normalisiert statt ueber `file: any` / `files: any[]`.
- `lib/diagnostics/smartPatch.ts`
  - Parse-/Merge-Fehler laufen jetzt ueber einen kleinen `unknown`-basierten `getErrorMessage(...)`-Helper statt `catch (e: any)`.
- `lib/diagnostics/buildPipelineDiagnostics.ts`
  - Der Repo-Secret-Listen-Fehlerpfad nutzt jetzt `unknown` + `getDiagnosticErrorMessage(...)` statt `catch (e: any)`.
- `supabase/functions/github-workflow-logs/helpers.ts`
  - Der 404-Run-Status wird helper-first ueber `asRecord(...)` / `asString(...)` statt `runJson: any` ausgewertet.

## Tests / Checks

- fokussierter Nachzug in `__tests__/patchEngine.jsonMergePreservesSiblings.test.ts` fuer den Invalid-JSON-Fehlerpfad
- neuer kleiner Helper-Test `__tests__/githubWorkflowLogs.helpers.test.ts`
- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`

## Ergebnis

- keine `: any` / `as any`-Reste mehr in den vier Ziel-Dateien
- helper-first, ohne Vertragsumbau
- naechster echter Typing-Block liegt jetzt klarer im Diagnostic-/Component-/props-nahen Bereich
