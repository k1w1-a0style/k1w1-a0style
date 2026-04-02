# Patch 715 - P2 lokale Guard-Audit-Telemetrie

## Kontext

Mit Patch 714 war nur noch der zweite P2-Punkt offen: lokale Audit-Telemetrie, um die Haeufigkeit von Guard-Blockern sichtbar zu machen, ohne sensible Inhalte nach außen zu senden.

## Aenderungen

1. Neues Modul `lib/guardAuditTelemetry.ts`:
   - `recordGuardAuditEvent(entries)` speichert lokale Guard-Event-Metriken in AsyncStorage
   - `readGuardAuditSnapshot()` liefert den aktuellen lokalen Snapshot
   - aggregiert nur Zaehler + Marker-Buckets (`kritisch`, `manual-only`, `baseline`, `read-only`, `ownership block`, `guarded`, `other`)
2. Neuer Storage-Key `STORAGE_KEYS.CHAT_GUARD_AUDIT`.
3. `ConfirmChangesModal` protokolliert bei sichtbarem Guard-Hinweis lokal ein Audit-Event (fire-and-forget, fail-safe).
4. Neue Regression `lib/__tests__/guardAuditTelemetry.test.ts` fuer:
   - korrektes Hochzaehlen/Bucketing
   - Resilienz bei malformed Storage-Payload
5. `docs/TODO.md` markiert den letzten offenen P2-Punkt als erledigt (Patch 715).

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand lib/__tests__/guardAuditTelemetry.test.ts __tests__/ConfirmChangesModal.review.test.tsx`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
