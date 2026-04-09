# Patch 771 — PreviewSecretSoTFinalize + QRResidualCleanup

## Kontext
Im verbleibenden Restblock waren noch drei echte Driftpunkte offen: (1) zentrale Doku enthielt teils veraltete Preview-Secret-Texte (`hash-first`/`legacy raw fallback`) trotz hash-only Runtime, (2) `check_docs_contracts.js` konnte diese semantische Drift nicht robust blocken, und (3) im Preview-Screen blieb totes/deaktiviertes QR-Restgeruest sichtbar.

## Umsetzung
1. **Preview-Secret-SoT auf hash-only gezogen**
   - Aktive SoT-Abschnitte in `docs/TODO.md` und `docs/reviews/Review.md` von Raw-Fallback-Erzaehlung auf den realen hash-only Vertrag umgestellt.
2. **Docs-Contract semantisch gehaertet**
   - `scripts/check_docs_contracts.js` um section-basierte Regeln erweitert (`extractSection`, `ensureNotPattern`).
   - Aktive Sektionen muessen `hash-only` enthalten und duerfen keine Legacy-Raw-Fallback-Marker enthalten.
3. **Preview-QR-Rest bereinigt**
   - QR-bezogene tote Props/Handler/Branches in `usePreviewScreen`, `PreviewScreen` und `PreviewToolbar` entfernt.
   - Kein externer QR-Reaktivierungspfad hinzugefuegt; Leak bleibt geschlossen.
4. **Type-only Zyklus aufgeloest**
   - Gemeinsame Workflow-Typen in `infra/github/workflowTypes.ts` ausgelagert; Parser und Orchestrator importieren nur noch diesen Typ-Hub.

## Verifikation
- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_verify_jwt_visibility.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run -s docs:lint`
- `bash scripts/check_release_readiness.sh`
