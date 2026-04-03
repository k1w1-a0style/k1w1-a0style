# TODO

Stand: **2026-04-03 (Patch 732, Security-/SoT-Nachzug)**
<!-- Legacy marker for docs contract tooling: Stand: **2026-04-02 (Docs Konsolidierung)** -->

> Ehrliche Restpunkt-SoT: getrennt nach (a) jetzt im Repo gefixt, (b) externen Live-/Supabase-Themen, (c) spaeteren Härtungen.

## 1) In diesem Durchlauf im Repo gefixt (nicht-live)

- [x] `K1W1_ALLOWED_GITHUB_REPOS` fail-closed gemacht (`supabase/functions/_shared/github.ts`): fehlend/leer blockiert jetzt statt default-open.
- [x] `K1W1_ALLOWED_REF_REGEX` fail-closed gemacht in:
  - `supabase/functions/trigger-eas-build/index.ts`
  - `supabase/functions/github-workflow-dispatch/index.ts`
- [x] `actions/upload-artifact` Pins auf konsistenten Full-SHA vereinheitlicht (`ea165f8d65b6e75b540449e92b4886f43607fa02`) in Workflows + Templates.
- [x] Lokalen HTML-/Eval-/Babel-/CDN-Fallback in `lib/sandpackBuilder.ts` fuer Production-/Release-Kontext hart deaktiviert (Guard + expliziter Disabled-HTML-Pfad), Dev/Test bleibt explizit nutzbar.

## 2) Offen: externe Live-/Supabase-Punkte (jetzt nur dokumentiert, nicht in diesem Repo-Durchlauf umsetzbar)

### Externe Betriebs-Restpunkte (bewusst ausserhalb Repo-Code)

Legacy-Contract-Marker: **Supabase-/Operator-Runbook-Restpunkt geschlossen** (historischer Marker; die untenstehenden Live-Punkte bleiben trotzdem offen bis externer Abschluss).

1. `save_preview` live: `verify_jwt = false` (soll `true` sein)
2. `k1w1-handler` live: `verify_jwt = false` (soll `true` sein)
3. `build_jobs`: gefaehrliche RLS-Policy mit effektivem public-Zugriff
4. `cleanup_old_previews(integer)`: `SECURITY DEFINER` + `PUBLIC EXECUTE`
5. `signing_audit_log`: keine explizite deny-policy
6. `diagnostics_reports`: Policy-Widerspruch / anon-Lesbarkeit klaeren
7. Trigger-/Hook-Funktionen ohne `search_path`
8. Leaked Password Protection nicht aktiv
9. Duplicate Indexes (Hygiene, spaeter)

## 3) Offen: Repo-Haertungen/Hygiene fuer spaeter (bewusst nicht in diesem kleinen Lauf)

1. `preview_page` Secret in Query-URL haerten
2. `SUPABASE_RAW`-Persistenz explizit absichern
3. Durable rate-limit fallback klarer dokumentieren + gezielt testen
4. Stille `.catch(() => {})` reduzieren
5. Leere `catch {}` in `WebCodeEditor.tsx` bereinigen
6. `console.log` in Produktivpfaden weiter abbauen
7. Sehr grosse Hooks/Dateien als Wartungsrisiko schrittweise aufteilen
8. Workflow-Hygiene-Nachzug nur mit engem Scope:
   - `npm install`-Fallback in produktnahen Pfaden weiter reduzieren, ohne dev-Bootstrap kaputtzumachen
   - Repo-Writebacks/persisted Credentials nur dort behalten, wo Push wirklich benoetigt wird

## 4) Benötigte externe Infos / Zugänge / Admin-Aktionen

- Supabase-Dashboard-/Admin-Zugriff (oder benannte verantwortliche Person mit diesem Zugriff).
- Berechtigung/Prozess, Edge Functions live zu deployen und `Require JWT` je Function sicher zu verifizieren/setzen.
- Berechtigung, produktive SQL-Migrationen auf Supabase auszufuehren.
- Verfuegbarkeit/Setzung folgender Secrets/Variablen in den Zielumgebungen:
  - `K1W1_EDGE_WORKFLOW_ADMIN_KEY`
  - `K1W1_ALLOWED_GITHUB_REPOS`
  - `K1W1_ALLOWED_REF_REGEX`
  - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
  - `PREVIEW_SUPABASE_URL` / `PREVIEW_SERVICE_ROLE_KEY`
  - `GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_API_TOKEN`
  - `SIGNING_ADMIN_KEY`
  - `SIGNING_MASTER_KEY`
- Moeglichkeit, gueltigen Operator-/Admin-JWT fuer Live-Contract-Tests zu erhalten.
- Klaerung, wie/wo `build_admin` extern provisioniert wird (Owner, Prozess, Rotation).
- Benennung, welches Team/System die realen Supabase-Live-Deployments durchfuehrt.

## 5) Hinweis zur frueheren Aussage

Die fruehere Pauschalaussage **"keine offenen Repo-Muss-Punkte"** war nach dem aktuellen Befund nicht mehr haltbar und wurde entsprechend korrigiert.

## Verbindliche Begleitquellen

- `docs/reviews/Review.md`
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`
