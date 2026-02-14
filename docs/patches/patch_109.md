# Patch 109 — GitHub Actions Logs Debug + Edge Auth Fix

## Änderungen
- `hooks/useGitHubActionsLogs.ts`
  - Status-genaue Fehlermeldungen für Edge Calls:
    - 404: Edge Function nicht deployed
    - 401: Admin Key fehlt/ungültig
    - 429: Rate limit
    - 5xx: fehlende Secrets / Edge Fehler
  - Fehlertext enthält einen kurzen redacted Snippet, damit man ohne Server-Logs schneller sieht, was schief läuft.

- `supabase/functions/github-workflow-logs/index.ts`
  - `requireAdminKey(req)` wird korrekt behandelt (`return` bei Fehler).
  - `rateLimit` korrekt auf `("github-workflow-logs", 60, 60_000)` gesetzt.

## Warum
- In der App stand bisher nur: „Logs nicht verfügbar“ — ohne Kontext, ob Deployment/Key/RateLimit/GitHub-Permissions.
- Zusätzlich war die Auth/RateLimit Nutzung im `github-workflow-logs` Function-Entry inkonsistent, was Fehlverhalten/Spam verursachen kann.

## Verification
- Start Build → „Logs öffnen“:
  - Ohne Admin Key: 401 + klarer Hinweis.
  - Mit falscher Supabase URL oder fehlender Function: 404 Hinweis.
  - Mit gültigem Key: Logs werden geladen (redacted + line-capped).
