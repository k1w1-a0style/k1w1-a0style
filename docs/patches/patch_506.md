# Patch 506: Diagnostic-Upload-Auth-Vertrag auf den echten Clientpfad zurechtgezogen

## Ziel

Den Widerspruch zwischen dem realen mobilen Uploadpfad und dem aktuellen RPC-Grant-Stand aufloesen, ohne neue Diagnostics-Architektur einzufuehren.

## Finale Vertragsentscheidung

**Gewaehlter Vertrag: A) anon-RPC bewusst erlauben.**

Begruendung:
- Der produktive Clientpfad ruft `insert_diagnostic_upload(jsonb)` bereits direkt ueber den normalen Supabase-Client auf.
- Im App-/Mobile-Pfad gibt es hier keine robuste zusaetzliche Auth-Session-Garantie, daher war `authenticated`-only fachlich widerspruechlich und je nach Laufzeit fragil bis kaputt.
- Die bestehenden SQL-seitigen Haertungen (SECURITY DEFINER RPC, Payload-Groessenlimit, Feldvalidierung, Idempotenz ueber `client_request_id`, Rate Limits pro IP/Geraet) bleiben erhalten; deshalb ist die Rueckkehr zu `anon` im engen Scope vertretbar.

## Umsetzung

- `lib/diagnostics/diagnosticUploader.ts`
  - dokumentiert den finalen Vertrag jetzt explizit: direkter Upload via `public.insert_diagnostic_upload(jsonb)` mit normalem Supabase-Client (anon-Key / optionale Session).
  - der Clientpfad bleibt bewusst klein und unveraendert direkt auf dem RPC, statt in einer halben Zwischenwelt aus impliziten Session-Annahmen zu haengen.
- `supabase/migrations/20260320000000_restore_insert_diagnostic_upload_anon_client_contract.sql`
  - stellt den finalen Auth-Vertrag explizit wieder her.
  - `PUBLIC` bleibt ausgeschlossen.
  - `anon`, `authenticated` und `service_role` bekommen `EXECUTE` auf `insert_diagnostic_upload(jsonb)`.
  - haelt per SQL-Kommentar sichtbar fest, dass der RPC ein Client-Diagnostics-Uploadpfad mit serverseitigen Guards ist.
- `__tests__/patch436.insertDiagnosticUploadContract.invariants.test.ts`
  - prueft jetzt die neue finale Auth-Migration statt die fruehere authenticated-only Zwischenphase als Endzustand zu behandeln.
- `__tests__/patch506.diagnosticUploadClientContract.test.ts`
  - deckt den echten Normalpfad ab: direkter RPC-Aufruf vom Client, stabile Payload-Form und intakte ID-Normalisierung.

## Guard-/Scope-Status

- Keine neue Edge-/Proxy-Architektur.
- Keine Lockerung von Payload-/Rate-/Idempotenz-Haertungen im SQL-Body.
- Keine Ausweitung auf andere Diagnostics-/DB-Themen.

## Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
