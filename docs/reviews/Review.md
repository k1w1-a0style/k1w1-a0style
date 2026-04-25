# REVIEW_DEEP_SCAN

Stand: **2026-04-24 (Patch 786, GradleWrapperShaAndroidTaskVerification)**
<!-- Legacy marker for docs contract tooling: Stand: **2026-04-02 (Docs Konsolidierung)** -->

## Rolle dieser Datei

- Diese Datei ist die **aktuelle Review-SoT** fuer den gegenwaertigen Gesamtstatus.
- `PROJECT_CHECKLOG.md` und `docs/patches/PATCHLOG_ROOT.md` bleiben bewusst **append-only Historie**.
- Historische Detailerzaehlungen werden hier nicht vollstaendig repliziert.

## Aktueller Gesamtstatus

- Dokumentierter Repo-Stand: Patch 786.
- Lokaler Verify-Status ohne Live-Variablen: erwartungsgemaess `OK_WITH_SKIPS`.
- `OK_FULL` gilt nur mit gesetzten `EDGE_BASE_URL` + `EDGE_OPERATOR_JWT` (oder als explizit historisch belegter Voll-Live-Lauf).
- Kein aktuell bekannter technischer High-Priority-Restpunkt im Repo-Scope; offene Themen sind in `docs/TODO.md` getrennt gelistet.

## Aktiv gueltige Leitlinien

- fail-closed Auth-/RBAC-Vertraege fuer privilegierte Edge-Routen bleiben verpflichtend.
- aktive Einstiegsdoku bleibt klein (`README`, `INDEX`, `FRESH_CHECKOUT`, `TESTING_GUIDE`).
- Checklog/Patchlog bleiben Historie und werden nicht als alleinige operative Freigabequelle gelesen.

## Kanonische Verifikation (relevant)

- `npm run typecheck`
- `npm run lint:ci`
- `npm run typecheck:edge`
- `npm run test:silent`
- `npm run docs:lint`
- `npm run docs:check:contracts`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `bash scripts/check_legacy_disabled_edges.sh`

## Spaetere sinnvolle Folgearbeit

1. read-only Live-Edge-Checks gegen Staging/Prod mit echten Operator-Variablen
2. groessere Refactors nur als explizite Features (kein impliziter Cleanup-Scope)


## Was heute aktiv gilt

- Preview-Secret-Vertrag: aktiv **hash-only** (kein Legacy-Raw-Fallback in der aktiven SoT).
- Keine offenen Repo-Muss-Punkte im aktuellen Repo-Scope; externe Themen bleiben separat/offen dokumentiert.
