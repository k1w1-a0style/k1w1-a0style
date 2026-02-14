# Patch 110 – Build: GitHub Actions Logs (404 = not ready)

Stand: 2026-02-14

## Ziel
Die In‑App Build‑Logs schlagen mit
`[github-workflow-logs] ... GitHub API Status: 404`
fehl, obwohl der Workflow‑Run existiert. GitHub liefert für den Logs‑Zip endpoint oft 404, solange der Run noch läuft oder GitHub den Zip noch nicht vorbereitet hat.

## Änderungen
- **Edge Function** `supabase/functions/github-workflow-logs`
  - Wenn Logs‑Fetch 404 liefert: Run‑Details werden geprüft.
  - Existiert der Run:
    - bei `status != completed` ⇒ Rückgabe `status: "not_ready"` + `retryAfterMs`
    - bei `completed` aber Zip noch nicht da ⇒ ebenfalls `not_ready` (transient)
  - Falls Run selbst 404: Hint im Error („run id“ vs „run number“ + Actions permissions)
- **App Hook** `hooks/useGitHubActionsLogs.ts`
  - `status: "not_ready"` wird als Info gezeigt (kein roter Fehler), Auto‑Refresh kann weiterlaufen.

## Verifikation
1. Build Screen öffnen → Run auswählen → **Live in App** öffnen.
2. Während `queued/in_progress`: keine rote 502‑Box mehr, stattdessen Info „Logs noch nicht verfügbar …“.
3. Nach Abschluss: Logs sollten automatisch erscheinen.

