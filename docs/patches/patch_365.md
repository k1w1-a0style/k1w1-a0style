# Patch 365 — CI Lite Smoke Script: run-id polling fix

## Problem
`./scripts/ci-lite-smoke.sh` hat nach dem Dispatch **kein `run_id` gefunden**, obwohl der Workflow gestartet wurde.

Ursache: Die Edge Function `github-workflow-runs` liefert die GitHub API Antwort **unter `data.workflow_runs`** (GitHub Standard), aber das Script hat fälschlich `runs[0].id` erwartet.

## Fix
- Script liest jetzt korrekt aus `data.workflow_runs`.
- Filtert nach `head_branch == <ref>`.
- Polling erhöht auf 20 Versuche (2s Interval), damit GitHub Zeit hat den Run zu erzeugen.
- Klarere Fehlermeldung, falls trotzdem nichts kommt.

## Test
```bash
set -a && source ./.env.ci-lite.local && set +a
chmod +x scripts/ci-lite-smoke.sh
./scripts/ci-lite-smoke.sh k1w1-a0style/musik-player k1w1-ci-lite-autofix.yml main
```
