# Patch 357 — CI Lite in-app: Autofix dispatch + eindeutige Statuslogik

## Problem
- In-App „Autofix ESLint“ hat `github-workflow-dispatch` mit **404 (workflow not found)** quittiert.
- CI Lite konnte **grün anzeigen**, obwohl der GitHub Run im Repo **failed** war (z.B. TS2307). Ursache: UI-Logik hat bei `conclusion=failure` trotzdem „OK“ gesetzt, wenn keine Errors aus Logs extrahiert wurden.

## Fix
1) **Autofix-Workflow bootstrap-fähig gemacht**
- `github-workflow-dispatch` hat jetzt ein Template für `k1w1-ci-lite-autofix.yml`.
- Damit kann die Edge Function den Workflow im Ziel-Repo automatisch anlegen (wenn Token `contents:write` hat) und danach dispatchen.

2) **CI Lite „OK“ nur noch bei echtem Erfolg**
- In `useCiLiteWorkflow` ist „OK“ jetzt **strict**: sobald GitHub `conclusion` liefert, ist nur `success` grün.
- Fallback (wenn Run-Metadaten fehlen): Logs/Error-Parse entscheidet.

## Dateien
- `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`
- `supabase/functions/github-workflow-dispatch/index.ts`
- `infra/github/workflowTemplates.ts`

## Hinweis
Wenn Dispatch/Bootstrap weiter 404/403 liefert, ist das oft ein Token-Problem (fine-grained PAT braucht **Actions: RW** und für Bootstrap zusätzlich **Contents: RW** auf dem Ziel-Repo).
