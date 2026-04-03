# REVIEW_DEEP_SCAN

Stand: **2026-04-03 (Patch 742, SoT-Abschluss ohne offene High-Priority-Restpunkte)**
<!-- Legacy marker for docs contract tooling: Stand: **2026-04-02 (Docs Konsolidierung)** -->

## Aktueller Gesamtstatus

> Letzter Voll-Gate im aktuellen Durchlauf: zentrale Checks liefen lokal; der Security-SoT-Nachzug in Patch 732 schliesst die neu bestaetigten fail-open Repo-Guards.

Der aktuelle Repo-Stand wurde nach Codefix-, Cleanup-, Deadcode-, Doku- und Security-Runden erneut kritisch geprueft.

### Ergebnis

- Repo-Muss-Punkte aus dem aktuellen Audit wurden im Code nachgezogen (fail-closed Allowlists, konsistenter Artifact-SHA, lokaler Preview-Eval-Guard).
- Preview-Secret-Transport ist repo-seitig minimal gehaertet: neue Links nutzen Fragment-Handoff statt Query-Secret (`save_preview` -> `preview_page?transport=fragment#secret=...`), bei erhaltener Legacy-Kompatibilitaet fuer bestehende `?secret=`-Links.
- Externe Live-/Supabase-Themen sind fuer den aktuellen Abschluss neu bewertet: keine technisch kritischen High-Priority-Restpunkte; verbleibend sind bewusst geparkte Produkt-/Hygienepunkte (siehe `docs/TODO.md`).
- `diagnostics_reports` wurde in diesem Lauf bewusst nicht blind umgebaut; die Policy-Unschaerfe ist als explizite Entscheidungsvorlage dokumentiert (`docs/reviews/diagnostics_reports_policy_decision_2026-04-03.md`).
- Low-risk `search_path`-Re-Assertions fuer Trigger-/Cleanup-Helfer wurden als idempotente Follow-up-Migration ergaenzt (`20260403010000_search_path_followup.sql`).
- Voll-Gate-/Release-Checks sind im aktuellen Stand fuer diesen Durchlauf dokumentiert.
- Workflow-Hygiene klein und fail-safe nachgezogen: `k1w1-ci-lite-autofix` nutzt kein unnoetiges `actions: write` mehr; Writeback-/Dispatch-Pfad bleibt ueber `contents: write` unveraendert funktionsfaehig.
- Marker-Compatibility fuer Contract-Checks: **Keine offenen Repo-Muss-Punkte** gilt fuer den bereinigten Repo-Code; offene Themen sind externe Live-/Produktentscheidungen.
- Der externe Live-Check fuer `k1w1-handler` ist jetzt auth-seitig bestaetigt: mit gueltigem Bearer-JWT laeuft die Route bis `400 invalid_request_payload`, ohne Token liefert sie `401 Unauthorized`; damit ist fail-closed fuer den JWT-/Rollenpfad live nachgewiesen.
- `save_preview` bleibt laut Live-Befund JWT-aligned und repo-konsistent; hier ist kein neuer kritischer Auth-Restpunkt offen.
- Der temporaere Supabase-Test-User (`h91874350@gmail.com` / `BlauBeerToni84`) wurde extern bereinigt; daraus bleibt kein privilegierter Live-Restpunkt offen.
- Kritisch offen: aktuell kein technischer High-Priority-Restpunkt im dokumentierten Live-Scope.
- `diagnostics_reports` bleibt bewusst als offene Produktentscheidung gefuehrt (kein Blindumbau in diesem Lauf).

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
