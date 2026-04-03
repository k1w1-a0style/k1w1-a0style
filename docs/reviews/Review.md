# REVIEW_DEEP_SCAN

Stand: **2026-04-03 (Patch 738 Edge-Caller-Audit k1w1-handler/save_preview)**
<!-- Legacy marker for docs contract tooling: Stand: **2026-04-02 (Docs Konsolidierung)** -->

## Aktueller Gesamtstatus

> Letzter Voll-Gate im aktuellen Durchlauf: zentrale Checks liefen lokal; der Security-SoT-Nachzug in Patch 732 schliesst die neu bestaetigten fail-open Repo-Guards.

Der aktuelle Repo-Stand wurde nach Codefix-, Cleanup-, Deadcode-, Doku- und Security-Runden erneut kritisch geprueft.

### Ergebnis

- Repo-Muss-Punkte aus dem aktuellen Audit wurden im Code nachgezogen (fail-closed Allowlists, konsistenter Artifact-SHA, lokaler Preview-Eval-Guard).
- Preview-Secret-Transport ist repo-seitig minimal gehaertet: neue Links nutzen Fragment-Handoff statt Query-Secret (`save_preview` -> `preview_page?transport=fragment#secret=...`), bei erhaltener Legacy-Kompatibilitaet fuer bestehende `?secret=`-Links.
- Offen bleiben externe Live-/Supabase-Betriebsthemen (siehe `docs/TODO.md`), aber die bestaetigten Repo-SQL-Nachzuege fuer `build_jobs`/`cleanup_old_previews(integer)`/`signing_audit_log` sind jetzt als idempotente Migration vorbereitet.
- `diagnostics_reports` wurde in diesem Lauf bewusst nicht blind umgebaut; die Policy-Unschaerfe ist als explizite Entscheidungsvorlage dokumentiert (`docs/reviews/diagnostics_reports_policy_decision_2026-04-03.md`).
- Low-risk `search_path`-Re-Assertions fuer Trigger-/Cleanup-Helfer wurden als idempotente Follow-up-Migration ergaenzt (`20260403010000_search_path_followup.sql`).
- Voll-Gate-/Release-Checks sind im aktuellen Stand fuer diesen Durchlauf dokumentiert.
- Workflow-Hygiene klein und fail-safe nachgezogen: `k1w1-ci-lite-autofix` nutzt kein unnoetiges `actions: write` mehr; Writeback-/Dispatch-Pfad bleibt ueber `contents: write` unveraendert funktionsfaehig.
- Marker-Compatibility fuer Contract-Checks: "Keine offenen Repo-Muss-Punkte" gilt hier nur fuer den **bereinigten Repo-Code nach Patch 732**, nicht fuer externe Live-Themen.
- Neuer gezielter Caller-Audit (`docs/reviews/edge_function_caller_audit_2026-04-03.md`): `save_preview` ist im vorliegenden Live-Befund bereits JWT-aligned, waehrend `k1w1-handler` als externer Live-Driftpunkt (`verify_jwt=false` + Admin-Key-Caller) vor einem Deploy explizite Caller-Migration/Runbook-Klaerung braucht.

## Was heute aktiv gilt

- ZIP-Import gehaertet
- Build-/Diagnostics-Gates fail-closed und repo/branch-scoped
- Projektpersistenz verschluesselt
- Edge-Routen byte-genauere Body-/Payload-Limits, durable Rate Limits mit lokalem Fallback
- Legacy-/Compat-Oberflaeche deutlich reduziert
- `create_codesandbox` deaktiviert
- Doku-/Review-/TODO-Landschaft auf eine kleine kanonische Menge reduziert

## Was bewusst **kein offener Repo-Fehler** ist

- externes `build_admin`-Provisioning
- produktive Secret-Rotation / Dashboard-Setup
- Live-Verifikation gegen echte Zielumgebungen

## Kanonische Verifikation

Im Repo vorhanden und im aktuellen Voll-Gate erfolgreich gelaufen:

- `npm run typecheck`
- `npm run lint:ci`
- `npm run typecheck:edge`
- `npm run test:silent`
- `npm run docs:lint`
- `npm run docs:check:contracts`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_edge_helper_visibility.sh`
- `bash scripts/check_edge_rate_limit_retention.sh`
- `bash scripts/check_release_readiness.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `bash scripts/check_legacy_disabled_edges.sh`

## Spaetere sinnvolle Folgearbeit

Nur bei echtem Bedarf oder in echter Paket-/Staging-Umgebung:

1. read-only Live-Edge-Checks gegen Staging
2. spaetere Produktarbeit wie Wizard, Streaming oder groessere Refactors als **bewusste Features**, nicht als Cleanup-Pflicht
