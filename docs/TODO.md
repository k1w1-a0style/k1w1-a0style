# TODO

Stand: **2026-04-07 (Patch 752, Preview-Expiry-Cleanup Hash/Legacy Fix)**
<!-- Legacy marker for docs contract tooling: Stand: **2026-04-02 (Docs Konsolidierung)** -->

> Ehrliche Restpunkt-SoT: getrennt nach (a) jetzt im Repo gefixt, (b) externen Live-/Supabase-Themen, (c) spaeteren Härtungen.

## 1) In diesem Durchlauf im Repo gefixt (nicht-live)

- [x] Persistenz-Recovery-Guardrails (Patch 746): Kein stilles Re-Keying im Read-/Decrypt-Pfad mehr, kaputte verschluesselte/Plaintext-Payloads fuehren in klaren Recovery-Fehler statt Null/Leerpfad, und Recovery-Mode blockiert normale Hintergrund-/Debounce-Speicherwrites bis zu einer expliziten Nutzeraktion (z. B. Import/Neues Projekt).
- [x] Secret-Import-Haertung (Patch 746): `EAS_PROJECT_ID` wird nur noch gesetzt, wenn der Wert UUID-valide ist; leer fuehrt zu Clear, invalide Werte werden nicht blind geschrieben.
- [x] Preview-Legacy-Removal (Patch 749): Query-Secret-Compat (`?secret=`) und Bridge sind vollstaendig entfernt; Preview akzeptiert Secrets nur noch ueber Fragment-Start + Header-Handoff.
- [x] Writeback-Scope weiter verengt (Patch 748): EAS-Build-Autofix **und** EAS-Link-Writeback erlauben nur noch `work|codex|dev|develop` (kein `main`, keine pauschalen `feature/*`, `hotfix/*`, `release/*`).
- [x] Disabled-Edge-Defaults (Patch 746): deaktivierte Legacy-Functions in `supabase/config.toml` auf `verify_jwt = true` vereinheitlicht (fail-safe Defaults trotz `enabled = false`).
- [x] AppInfo Secret-Import Status-Reset (Patch 745) aus `useAppInfoScreen` in `screens/AppInfoScreen/hooks/secretImportStatusReset.ts` entkoppelt; test-only Export im Hook entfernt und Test auf direkten Helper-Import umgestellt.
- [x] Release-/Workflow-Trust-Drift (Patch 744): `check_workflow_edge_contracts.sh` war lokal reproduzierbar rot wegen fehlendem build_admin-Contract-Marker in `useCiLiteWorkflow.ts`; Marker wurde auf den geforderten Wortlaut nachgezogen und der Gate-Pfad (`check_release_readiness.sh`) anschliessend wieder lokal gruen bestaetigt.
- [x] Manueller `eas-link`-Workflow Writeback gehaertet: read-default auf Workflow-Ebene, job-scoped `contents: write`, plus explizite sichere Branch-Guards (kein SHA/unsafe/detached Ref, kein stilles Push-`|| true`).
- [x] AppInfo-Secret-Hotfixes (Patch 743): API-Config-Export redaktiert API-Keys fail-closed (kein Klartextpfad), API-Config-/Encrypted-Scoped-Backup-Import/Export raeumt temporäre Cache-Dateien idempotent auf, und Secure-Backup exportiert keine unnoetige Token-Duplikation mehr ueber `ciSecrets`.
- [x] `K1W1_ALLOWED_GITHUB_REPOS` fail-closed gemacht (`supabase/functions/_shared/github.ts`): fehlend/leer blockiert jetzt statt default-open.
- [x] `K1W1_ALLOWED_REF_REGEX` fail-closed gemacht in:
  - `supabase/functions/trigger-eas-build/index.ts`
  - `supabase/functions/github-workflow-dispatch/index.ts`
- [x] `actions/upload-artifact` Pins auf konsistenten Full-SHA vereinheitlicht (`ea165f8d65b6e75b540449e92b4886f43607fa02`) in Workflows + Templates.
- [x] Drift in eingebetteten Template-Workflow-Kopien geschlossen (`templates/expo-sdk54-base.json`, `templates/expo-sdk54-full.json` jetzt wieder baseline-aligned zu `.github/workflows/eas-build.yml` und `.github/workflows/release-build.yml`).
- [x] `k1w1-ci-lite-autofix` Workflow-Permissions minimalisiert: unnoetiges `actions: write` entfernt; `contents: write` bleibt fuer guarded Writeback/Dispatch erhalten.
- [x] Lokalen HTML-/Eval-/Babel-/CDN-Fallback in `lib/sandpackBuilder.ts` fuer Production-/Release-Kontext hart deaktiviert (Guard + expliziter Disabled-HTML-Pfad), Dev/Test bleibt explizit nutzbar.
- [x] Preview-Secret-Modell gehaertet (Patch 751): `save_preview` speichert Secret nur noch gehasht, `preview_page` nutzt hash-first Lookup und fallbackt nur fuer bestehende Legacy-Klartextsaetze.
- [x] Preview-Auth-Boundary klein nachgeschaerft (Patch 751): `preview_page` akzeptiert nur GET/HEAD; Secret bleibt Header-basiert (Fragment-Handoff), kein Query-Secret-Revival.
- [x] Preview-Expiry-Cleanup nach Secret-Hashing repariert (Patch 752): Expiry-Delete nutzt dieselben Secret-Kandidaten (hash-first + legacy raw fallback) wie der Lookup, damit gehashte und alte raw Rows gleichermassen loeschbar bleiben.
- [x] `SUPABASE_RAW`-Persistenz explizit gehaertet: Legacy-Secret-Composite (`url:::key`) wird aktiv verworfen, inkl. Regressionstest.
- [x] Durable rate-limit fallback transparenter gemacht: Fallback-Warnungen markieren jetzt explizit `local_in_memory_best_effort` + `cluster_safe=false`, inkl. Testabdeckung.
- [x] RateLimit-Degradation fuer Preview-Routen geschaerft (Patch 751): `save_preview`/`preview_page` setzen `enforceDurable: true`; bei durable-Ausfall jetzt `503 rate_limit_unavailable` statt lokaler Scheinsicherheit.
- [x] Neue Repo-Migration fuer bestaetigte Live-Befunde vorbereitet (`supabase/migrations/20260403000000_supabase_live_findings_hardening.sql`) — fail-closed Re-Assertion fuer `build_jobs`, Legacy-Haertung fuer `cleanup_old_previews(integer)` und explizite deny-Policies fuer `signing_audit_log` (ohne Live-Mutation).

## 2) Externer Live-Status: ehrliche Restpunktbewertung (read-only dokumentiert)

### Externe Betriebs-Restpunkte (bewusst ausserhalb Repo-Code)

Legacy-Contract-Marker: **Supabase-/Operator-Runbook-Restpunkt geschlossen** (historischer Marker; kein offener privilegierter Testzustand aus dem bereinigten Test-User).

### Kritisch offen

- Keine aktuell erkennbaren **technisch kritischen** High-Priority-Restpunkte im dokumentierten Supabase-/Live-Scope.

### Bewusst offen / Produktentscheidung

- `diagnostics_reports`: bleibt bewusst offene Produktentscheidung (A/B), kein Blindumbau.
- Referenz: Decision-Note 2026-04-03 (`docs/reviews/diagnostics_reports_policy_decision_2026-04-03.md`).

### Niedrige Prioritaet / Hygiene

- Temporaerer Test-User `h91874350@gmail.com` / `BlauBeerToni84` wurde operativ bereinigt; daraus bleibt kein privilegierter Testzustand offen.
- Optionale spaetere Hygiene: Trigger-/Hook-Funktionen ohne `search_path` punktuell live querpruefen.
- Follow-up-Migration fuer Suchpfad-Reassertion bereits vorbereitet: `20260403010000_search_path_followup.sql`.
- Optionale Plattformhygiene: Leaked Password Protection + Duplicate Indexes separat behandeln.

## 3) Offen: Repo-Haertungen/Hygiene fuer spaeter (bewusst nicht in diesem kleinen Lauf)

1. verify_jwt-Flag-Drift frueher sichtbar machen (aktueller Flag-Audit fuer `save_preview`/`k1w1-handler` ist erledigt; als kuenftige Betriebshygiene bleibt ein expliziter Re-Check pro Release sinnvoll)
2. Stille `.catch(() => {})` weiter reduzieren (kritische Chat-Privacy-Catches sind in Patch 751 bereits auf Warn-Logging umgestellt)
3. Leere `catch {}` in `WebCodeEditor.tsx` bereinigen
4. `console.log` in Produktivpfaden weiter abbauen
5. Sehr grosse Hooks/Dateien als Wartungsrisiko schrittweise aufteilen
6. Workflow-Hygiene-Nachzug nur mit engem Scope:
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
