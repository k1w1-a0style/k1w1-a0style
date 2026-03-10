# Supabase Deploy & Migrations Runbook

Stand: 2026-03-10

## Ziel

Sichere, wiederholbare Schritte um:

1) Edge Functions zu deployen
2) Datenbank-Migrations in `supabase/migrations/` auf Remote anzuwenden
3) Minimalen Smoke-Check zu machen

## Vorbedingungen

- `supabase` CLI installiert und am Projekt angemeldet
- `.env`/Secrets vorhanden (Service Role Key **nie** in Logs/Issues posten)
- Optional (lokal): Docker, wenn du Supabase lokal starten willst

## 1) Edge Functions deployen

### Alle Functions deployen

```bash
supabase functions deploy
```

### Einzelne Function deployen (optional)

```bash
supabase functions deploy <function-name>
```

## 2) DB-Migrations pushen

```bash
supabase db push
```

Wenn neue Migrations erkannt werden, fragt die CLI nach Bestätigung.

## 3) Smoke-Checks

### A) CLI Status check

```bash
supabase status
```

### B) Function erreichbar?

- Dashboard → Project → Edge Functions
- Eine einfache Function (z. B. `test`) aufrufen

### C) Migration angewendet?

- Dashboard → Database → Migrations
- Prüfen, ob die neue Datei auftaucht und "applied" ist

## Troubleshooting

### "WARNING: Docker is not running"

- Für **Remote Deploy** ist das in der Regel ok.
- Du brauchst Docker nur für lokale Supabase-Instanzen.

### Deploy schlägt fehl: "Module not found .../_shared/errorSanitization"

Das ist fast immer ein **Deno import extension** Thema.

- In Supabase Edge Functions müssen lokale Imports die Dateiendung enthalten:
  - ✅ `../_shared/errorSanitization.ts`
  - ❌ `../_shared/errorSanitization`

Fix: Imports auf `.ts` umstellen, dann erneut `supabase functions deploy`.

### Migration schlägt fehl

1) Fehlertext lesen
2) Prüfen ob es bereits alte Policies/Objekte gibt (idempotent-Migrationen sollten das abfangen)
3) Notfalls: `supabase db reset` nur lokal (Achtung: löscht lokale DB!)

#### Spezialfall: "must be owner of table storage.objects"

Auf manchen Projekten ist die Migration-Rolle **nicht Owner** von `storage.objects`.

- Empfehlung: Storage-Hardening entweder
  - (A) in der Migration **nur best-effort** (mit `EXCEPTION when insufficient_privilege`) laufen lassen, oder
  - (B) als **manueller Schritt** im Dashboard → SQL Editor mit einer Owner-Rolle ausführen.

## Rollback-Strategie (pragmatisch)

- **Edge Functions**: vorherige Version erneut deployen (Git revert + deploy)
- **DB**: neue Migration möglichst so schreiben, dass sie rückgängig machbar ist (Down-Migrationen gibt es hier nicht automatisch)
  - In der Praxis: "Revert"-Migration schreiben (neue Datei), die Policies/Funktionen wiederherstellt


## GitHub Workflow (`deploy-supabase-functions.yml`)

Der Repo-Workflow deployt Supabase jetzt **nur noch manuell** per `workflow_dispatch`.

Pflicht-/Steuerungsinputs:
- `ref`: Branch/Tag/SHA, der ausgecheckt und deployed wird
- `deploy_all`: alle Functions oder nur eine einzelne Function deployen
- `function_name`: nur relevant bei `deploy_all=false`
- `apply_migrations`: `auto|true|false`

Regeln:
- Kein automatischer `push`-Deploy mehr
- `_shared` darf nie als Function deployed werden
- `function_name` wird validiert
- `apply_migrations=auto` nutzt die Änderungserkennung gegen `supabase/migrations/`
