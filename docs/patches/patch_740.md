# Patch 740

Datum: 2026-04-03

## Ziel
Kleiner Review-Follow-up: SoT-Doku fuer den bestaetigten Live-Abschluss von `k1w1-handler` widerspruchsfrei konsolidieren (docs-only).

## Aenderungen
- `docs/reviews/edge_function_caller_audit_2026-04-03.md` komplett auf den bestaetigten Ist-Stand gezogen:
  - `k1w1-handler` live auth-seitig bestaetigt (Bearer-JWT => `400 invalid_request_payload`, ohne Token => `401`)
  - kein verbleibender kritischer Auth-Migrationspunkt mehr in diesem Audit
  - `save_preview` weiterhin live/repo-konsistent
- `docs/TODO.md` Marker-Text praezisiert (kritischer Auth-Restpunkt als geschlossen vermerkt).
- `docs/reviews/Review.md` Stand-/SoT-Nachzug.
- `README.md` Patch-/Stand-Marker auf Patch 740 gezogen.
- Historie nachgezogen in `PROJECT_CHECKLOG.md` und `docs/patches/PATCHLOG_ROOT.md`.

## Bewusst offen
- `diagnostics_reports` bleibt offene Produktentscheidung.
- Keine Runtime-/Edge-/Workflow-Aenderung.
- Kein Deploy, kein `db push`, keine Live-Mutation.

## Verifikation
- `npm run typecheck`
- `npm run typecheck:edge`
- `npm run lint:ci`
- `npm run docs:check:contracts`
- `bash scripts/check_patch_docs_sync.sh`
