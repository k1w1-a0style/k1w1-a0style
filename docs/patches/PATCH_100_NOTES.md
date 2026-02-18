# PATCH 100 – Supabase deploy + migration follow-ups

Stand: 2026-02-13

## Kontext
Nach Patch 99 traten zwei Ops-Probleme auf:

1) `supabase functions deploy` brach bei einzelnen Functions mit
   **"Module not found .../_shared/errorSanitization"** ab.
2) `supabase db push` scheiterte auf manchen Projekten mit
   **"must be owner of table objects"** (Storage Schema / `storage.objects`).

## Änderungen

### 1) Edge Functions Deploy: Deno Import Extensions
Supabase Edge läuft auf Deno. Deno benötigt bei lokalen Imports die Dateiendung.
Wir erzwingen daher `.ts` in Imports auf `errorSanitization`.

Betroffene Dateien:
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/create_codesandbox/index.ts`
- `supabase/functions/save_preview/index.ts`

### 2) Migration: Storage Ownership Guard
Der Storage-Härtungsteil für `storage.objects` ist sinnvoll, aber nicht überall möglich,
wenn die Migration-Role nicht Owner der Tabelle ist.

Die Migration fängt jetzt `insufficient_privilege` ab und setzt nur ein NOTICE,
damit der Rest der RLS-Audit-Härtung trotzdem sauber durchläuft.

Hinweis: Wenn du die Storage-Härtung unbedingt willst, führe sie im Dashboard SQL Editor
als Owner/`postgres` aus.

## Quick Commands

```bash
npm run typecheck
npm run lint:ci
npm run test:silent

supabase functions deploy
supabase db push
```
