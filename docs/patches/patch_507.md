# Patch 507: DB-/Schema-Referenzlage fuer Public-Contracts ehrlich gezogen

## Ziel

Die repo-seitige Referenz fuer das Public-Schema und die relevanten Diagnostics-Vertraege so aufraeumen, dass keine leere oder irrefuehrende `schema.public.sql` mehr neben den echten Migrationen steht.

## Ist-Zustand

- `supabase/schema.public.sql` war faktisch leer und lieferte damit keine brauchbare Aussage zur aktuellen DB-Realitaet.
- Die echte Vertragslage lag bereits verteilt in den Migrationsdateien, insbesondere rund um `public.diagnostic_uploads`, `public.diagnostics_reports` und `public.insert_diagnostic_upload(jsonb)`.
- Bestehende Invariants (`patch436`, `patch439`, `patch506`) sicherten die finale Diagnostics-RPC-Historie bereits gut ab, aber nicht die repo-seitige Snapshot-/Referenzdatei selbst.

## Gewaehlte SoT-/Referenz-Strategie

**Strategie B mit kleinem ehrlichen Snapshot:**

- **Kanonische SoT bleibt:** `supabase/migrations/*.sql` plus DB-/RPC-Invariants in `__tests__/`.
- **`supabase/schema.public.sql` bleibt bewusst sekundaer:** Die Datei ist jetzt explizit als abgeleitete Referenz markiert.
- **Inhalt nur im engen Scope:** Statt einen vermeintlich vollstaendigen Dump zu behaupten, snapshotet die Datei nur die aktuell relevanten Public-Contracts fuer diesen Repo-Kontext:
  - `public.diagnostic_uploads`
  - `public.insert_diagnostic_upload(jsonb)`
  - `public.diagnostics_reports`

Warum nicht Vollsnapshot?
- Ein kompletter, manuell gepflegter Schema-Dump waere hier driftanfaelliger und teurer als der konkrete Nutzen.
- Der aktuelle Bedarf war vor allem: keine leere/irrefuehrende Referenzdatei mehr und klare Benennung, wo die echte Wahrheit liegt.

## Umsetzung

- `supabase/schema.public.sql`
  - enthaelt jetzt einen klaren SoT-Hinweis (Migrationen + Invariants sind kanonisch).
  - zeigt einen kleinen aktuellen Snapshot der relevanten Public-Vertraege statt leerem Inhalt.
  - dokumentiert explizit, dass der historische UUID-/Legacy-Spalten-Drift **nicht** Teil des aktuellen Vertrags ist.
  - haelt fuer `diagnostics_reports` sichtbar fest, dass kein oeffentlicher History-RPC Teil des aktuellen App-Vertrags ist.
- `__tests__/patch507.schemaPublicReference.invariants.test.ts`
  - prueft, dass `schema.public.sql` nicht leer ist und sich selbst ehrlich als sekundäre Referenz bezeichnet.
  - gleicht den Snapshot gegen die kanonischen Migrationen fuer den finalen bigint-RPC-Vertrag und die finalen Grants ab.
  - blockiert Re-Intro der alten UUID-/Legacy-Spaltenwelt in den aktuellen Upload-Snapshot.

## Guard-/Scope-Status

- Keine Dependency-Updates.
- Keine Migrations-Rewrites.
- Keine neue DB-Architektur.
- Nur Referenz-/Truth-Aufraeumung plus gezielte Invariant-Absicherung.

## Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
