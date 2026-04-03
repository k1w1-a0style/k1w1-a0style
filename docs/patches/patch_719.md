# Patch 719 - Guard-Telemetrie Event-Normalisierung + Payload-Cap

## Kontext

Zur weiteren Safety-Haertung der lokalen Guard-Audit-Telemetrie wurde der Event-Input defensiver gemacht: leere/noisy Eintraege sollen nicht zaehlen und sehr grosse Event-Listen sollen nicht unkontrolliert wachsen.

## Aenderungen

1. `lib/guardAuditTelemetry.ts` normalisiert Event-Eintraege vor dem Schreiben:
   - trimmt Strings
   - filtert leere Eintraege
2. Pro Event wird die verarbeitete Entry-Liste auf **max. 50** Eintraege begrenzt (`MAX_ENTRIES_PER_EVENT`).
3. `toMarkerBucket(...)` arbeitet jetzt explizit auf getrimmtem lowercase Input.
4. `lib/__tests__/guardAuditTelemetry.test.ts` erweitert:
   - leere/noisy Eintraege werden ignoriert
   - oversized Payload wird auf 50 Eintraege gecappt

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand lib/__tests__/guardAuditTelemetry.test.ts __tests__/confirmChangesModal.guardAuditFlow.test.tsx`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
