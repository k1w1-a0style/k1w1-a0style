# Patch 739

Datum: 2026-04-03

## Ziel
Kleine, ehrliche Abschluss-Synchronisierung der Repo-SoT nach extern bestaetigtem Live-Auth-Check fuer `k1w1-handler`.

## Aenderungen
- `docs/TODO.md`: externer Live-Status aktualisiert; `k1w1-handler` auth-seitig als bestaetigt markiert (`Bearer-JWT` => `400 invalid_request_payload`, ohne Token => `401`).
- `docs/reviews/Review.md`: Gesamtstatus entsprechend korrigiert; kritischer Auth-Driftpunkt `k1w1-handler` nicht mehr als offen gefuehrt.
- `docs/reviews/edge_function_caller_audit_2026-04-03.md`: Nachtrag mit bestaetigtem read-only Live-Check.
- `README.md`: Stand + Patch-Marker (`Zuletzt abgeschlossen: Patch 739`) auf aktuellen SoT-Stand gezogen.
- `PROJECT_CHECKLOG.md` und `docs/patches/PATCHLOG_ROOT.md`: Historieneintrag fuer Patch 739 ergaenzt.

## Offen / bewusst nicht geaendert
- `diagnostics_reports` bleibt bewusst offene Produktentscheidung.
- Keine Runtime-/Edge-/Workflow-Codeaenderung.
- Kein Deploy, kein `db push`, keine Dashboard-/Live-Mutation.

## Verifikation
- `npm run typecheck`
- `npm run typecheck:edge`
- `npm run lint:ci`
- `bash scripts/check_patch_docs_sync.sh`
