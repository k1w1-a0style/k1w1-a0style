# Patch 436 — Finalisierung `insert_diagnostic_upload` Vertrag (Migration/RPC-Hygiene)

## Ziel
Historische Drift rund um `insert_diagnostic_upload` sauber einordnen und den finalen DB-/RPC-Vertrag deploy-sicher reasserten, ohne Alt-Migrationen umzuschreiben.

## Gefundene echte Probleme
- Historische Drift in der Migrationskette:
  - `20260203000000_harden_diagnostics_reports_and_rpc.sql` definiert `insert_diagnostic_upload(jsonb)` temporär als `returns uuid`.
  - Diese Version mappt auf Spalten `repo/branch/mode/platform/report/meta`, die in `public.diagnostic_uploads` nicht zum kanonischen Tabellenschema gehören.
- `20260203000002_fix_insert_diagnostic_upload_return_type.sql` verstärkt denselben `uuid`-/Spalten-Drift erneut (guarded recreate).
- Spätere Migrationen haben auf `bigint` zurückgestellt, die Historie blieb aber irreführend und ohne explizite Abschluss-Klarstellung.

## Minimaler Fix
- Neue Abschluss-Migration `20260315000100_finalize_insert_diagnostic_upload_contract.sql` ergänzt.
- Diese reassertet explizit den finalen Vertrag:
  - Signatur: `insert_diagnostic_upload(payload jsonb)`
  - Return-Typ: `bigint`
  - Zielspalten: `device_id, client_request_id, app_version, project_name, target, summary, snapshots, notes, ip`
  - Idempotenz: `on conflict (device_id, client_request_id)`
  - Rechte: `authenticated + service_role`, kein `public`/`anon`
- Legacy-Overload mit 8 Parametern wird defensiv gedroppt.

## Tests
- Neuer Invariant-Test `__tests__/patch436.insertDiagnosticUploadContract.invariants.test.ts`:
  - dokumentiert den historischen `uuid`-/Spalten-Drift in der Altmigration,
  - erzwingt im neuen Finalize-Migrationstext den kanonischen `bigint`-Vertrag,
  - erzwingt Grants/Revoke-Vertrag (`authenticated + service_role`, nicht `public`/`anon`).

## Client-Vertrag
- Client-Normalisierung bleibt bewusst tolerant für uuid-artige IDs als Übergangsschutz für Alt-Deploystände; Kommentar wurde auf historischen Drift präzisiert.
- Produktiver Zielvertrag bleibt dennoch eindeutig `bigint`-backed (im Client als opaque string verarbeitet).

## Ehrliche Rest-Einordnung
- Historische Zwischenzustände bleiben als Teil der append-only Migration-Historie sichtbar.
- Sie werden nicht „weggezaubert“, sondern durch klare Finalize-Migration + Invariant-Absicherung übersteuert und dokumentiert.
