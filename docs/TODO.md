# TODO

Stand: **2026-04-03 (Patch 741, MD-Check + Test-User-Cleanup-Status nachgezogen)**
<!-- Legacy marker for docs contract tooling: Stand: **2026-04-02 (Docs Konsolidierung)** -->

> Ehrliche Restpunkt-SoT: getrennt nach (a) jetzt im Repo gefixt, (b) externen Live-/Supabase-Themen, (c) spaeteren Härtungen.

## 1) In diesem Durchlauf im Repo gefixt (nicht-live)

- [x] `K1W1_ALLOWED_GITHUB_REPOS` fail-closed gemacht (`supabase/functions/_shared/github.ts`): fehlend/leer blockiert jetzt statt default-open.
- [x] `K1W1_ALLOWED_REF_REGEX` fail-closed gemacht in:
  - `supabase/functions/trigger-eas-build/index.ts`
  - `supabase/functions/github-workflow-dispatch/index.ts`
- [x] `actions/upload-artifact` Pins auf konsistenten Full-SHA vereinheitlicht (`ea165f8d65b6e75b540449e92b4886f43607fa02`) in Workflows + Templates.
- [x] Drift in eingebetteten Template-Workflow-Kopien geschlossen (`templates/expo-sdk54-base.json`, `templates/expo-sdk54-full.json` jetzt wieder baseline-aligned zu `.github/workflows/eas-build.yml` und `.github/workflows/release-build.yml`).
- [x] `k1w1-ci-lite-autofix` Workflow-Permissions minimalisiert: unnoetiges `actions: write` entfernt; `contents: write` bleibt fuer guarded Writeback/Dispatch erhalten.
- [x] Lokalen HTML-/Eval-/Babel-/CDN-Fallback in `lib/sandpackBuilder.ts` fuer Production-/Release-Kontext hart deaktiviert (Guard + expliziter Disabled-HTML-Pfad), Dev/Test bleibt explizit nutzbar.
- [x] `SUPABASE_RAW`-Persistenz explizit gehaertet: Legacy-Secret-Composite (`url:::key`) wird aktiv verworfen, inkl. Regressionstest.
- [x] Durable rate-limit fallback transparenter gemacht: Fallback-Warnungen markieren jetzt explizit `local_in_memory_best_effort` + `cluster_safe=false`, inkl. Testabdeckung.
- [x] Neue Repo-Migration fuer bestaetigte Live-Befunde vorbereitet (`supabase/migrations/20260403000000_supabase_live_findings_hardening.sql`) — fail-closed Re-Assertion fuer `build_jobs`, Legacy-Haertung fuer `cleanup_old_previews(integer)` und explizite deny-Policies fuer `signing_audit_log` (ohne Live-Mutation).

## 2) Externer Live-Status: Abschluss + offene Restpunkte (nur dokumentiert, keine Live-Mutation in diesem Lauf)

### Externe Betriebs-Restpunkte (bewusst ausserhalb Repo-Code)

Legacy-Contract-Marker: **Supabase-/Operator-Runbook-Restpunkt geschlossen** (historischer Marker; der kritische Auth-Restpunkt `k1w1-handler` ist jetzt ebenfalls extern bestaetigt geschlossen).

1. `k1w1-handler` live auth-seitig bestaetigt (externer Read-only Check):
   - mit gueltigem Bearer-JWT wird Auth passiert und der Request scheitert erst fachlich mit `400 invalid_request_payload`
   - ohne Token liefert die Route `401 Unauthorized`
   - Ergebnis: JWT-/Rollenpfad live wirksam, fail-closed Verhalten bestaetigt
2. `save_preview` bleibt live/repo-konsistent (`verify_jwt = true` bereits bestaetigt; kein akuter Live-Flag-Restpunkt)
3. Temporaerer Test-User `h91874350@gmail.com` / `BlauBeerToni84` wurde extern bereinigt (kein privilegierter Testzustand mehr offen).
4. `build_jobs`: Live-RLS auf Repo-SoT ausstehend (Repo-Migration vorhanden, Live-Apply extern)
5. `cleanup_old_previews(integer)`: Legacy-Live-Haertung extern ausstehend (Repo-Migration vorbereitet)
6. `signing_audit_log`: explizite deny-policy live ausstehend (Repo-Migration vorbereitet)
7. `diagnostics_reports`: Policy-Widerspruch ist analysiert (Decision-Note 2026-04-03), Produktentscheidung A/B offen
8. Trigger-/Hook-Funktionen ohne `search_path` live final pruefen (Repo-seitig low-risk Nachzug via Migration `20260403010000_search_path_followup.sql` erfolgt)
9. Leaked Password Protection nicht aktiv
10. Duplicate Indexes (Hygiene, spaeter)

## 3) Offen: Repo-Haertungen/Hygiene fuer spaeter (bewusst nicht in diesem kleinen Lauf)

1. Legacy-Preview-Links mit `?secret=...` weiterhin operativ beobachten/rotieren (neue Links nutzen jetzt Fragment-Handoff)
2. verify_jwt-Flag-Drift frueher sichtbar machen (auch nach bestandenem Verhaltenscheck bleibt ein expliziter Flag-Audit sinnvoller Operator-Schritt)
3. Stille `.catch(() => {})` reduzieren
4. Leere `catch {}` in `WebCodeEditor.tsx` bereinigen
5. `console.log` in Produktivpfaden weiter abbauen
6. Sehr grosse Hooks/Dateien als Wartungsrisiko schrittweise aufteilen
7. Workflow-Hygiene-Nachzug nur mit engem Scope:
   - `npm install`-Fallback in produktnahen Pfaden weiter reduzieren, ohne dev-Bootstrap kaputtzumachen
   - Repo-Writebacks/persisted Credentials weiter punktuell pruefen; CI-Lite-Autofix-Permission-Scope ist bereits auf `contents: write` reduziert

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
