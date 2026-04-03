# REVIEW_DEEP_SCAN

Stand: **2026-04-03 (Patch 732 SoT-Nachzug)**
<!-- Legacy marker for docs contract tooling: Stand: **2026-04-02 (Docs Konsolidierung)** -->

## Aktueller Gesamtstatus

> Letzter Voll-Gate im aktuellen Durchlauf: zentrale Checks liefen lokal; der Security-SoT-Nachzug in Patch 732 schliesst die neu bestaetigten fail-open Repo-Guards.

Der aktuelle Repo-Stand wurde nach Codefix-, Cleanup-, Deadcode-, Doku- und Security-Runden erneut kritisch geprueft.

### Ergebnis

- Repo-Muss-Punkte aus dem aktuellen Audit wurden im Code nachgezogen (fail-closed Allowlists, konsistenter Artifact-SHA, lokaler Preview-Eval-Guard).
- Offen bleiben externe Live-/Supabase-Betriebsthemen (siehe `docs/TODO.md`).
- Voll-Gate-/Release-Checks sind im aktuellen Stand fuer diesen Durchlauf dokumentiert.
- Marker-Compatibility fuer Contract-Checks: "Keine offenen Repo-Muss-Punkte" gilt hier nur fuer den **bereinigten Repo-Code nach Patch 732**, nicht fuer externe Live-Themen.

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
