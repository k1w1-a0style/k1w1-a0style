# Patch 317: Preview server limits + cleanup cron

## Ziel

Die nächsten offenen Punkte aus der Fix-Liste abschließen:

1. `save_preview` serverseitig mit harten Limits für Payload-Bytes und Dateianzahl absichern.
2. `cleanup_expired_previews()` regelmäßig per Supabase-Cron ausführen.

## Änderungen

- `supabase/functions/save_preview/helpers.ts`
  - Neue zentrale Constants:
    - `MAX_FILES_COUNT = 250`
    - `MAX_PAYLOAD_BYTES = 1_500_000`
  - `sanitizeFiles()` nutzt diese Constants statt Magic Numbers.

- `supabase/functions/save_preview/index.ts`
  - Nutzt `MAX_PAYLOAD_BYTES` direkt beim Body-Parsing und bei der finalen Größenprüfung.
  - Ergänzt expliziten Dateianzahl-Guard vor dem Insert:
    - `Object.keys(body.files).length > MAX_FILES_COUNT` → `413` mit klarer Fehlermeldung.

- `supabase/migrations/20260228123000_schedule_preview_cleanup_cron.sql`
  - `create extension if not exists pg_cron;`
  - Idempotentes Reschedule für Job `cleanup-expired-previews-hourly`.
  - Schedule: stündlich (`0 * * * *`) mit `select public.cleanup_expired_previews();`.

- Docs Sync
  - `docs/PROJECT_TODO.md`: beide Punkte als erledigt markiert.
  - `docs/patches/PATCHLOG_ROOT.md`, `PROJECT_CHECKLOG.md`, `README.md` aktualisiert.

## Checks

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
