# Patch 615: Preview-Standardpfad ohne stillen Legacy-Admin-Key-Fallback

## Problem

Der normale Preview-Clientpfad (`hooks/usePreview.ts`, Modus `preferredPreviewMode: "supabase"`) hing weiterhin am Legacy-Admin-Key-Vertrag (`getLegacyEdgeAdminKey()` -> `save_preview`).
Damit blieb ein privilegierter Legacy-Key im Standardbetrieb ein stiller Rettungsanker.

## Ziel

- Standard-Previewfluss darf den Legacy-Admin-Key **nicht mehr still** nutzen.
- Legacy-`save_preview` darf nur noch als **expliziter** Operator-/Maintenance-Compatpfad aktiv sein.
- Fehlertexte muessen den echten Zustand ehrlich kommunizieren (kein "normaler" Erfolg ueber Altprivileg).

## Aenderung

1. `hooks/usePreview.ts`
   - Neuer harter Guard im Supabase-Previewpfad:
     - Legacy-`save_preview` wird nur noch aufgerufen, wenn
       `EXPO_PUBLIC_ENABLE_LEGACY_PREVIEW_OPERATOR_MODE=true` gesetzt ist.
   - Ohne expliziten Operator-Flag:
     - kein Zugriff auf `getLegacyEdgeAdminKey()`
     - kein `save_preview`-Request
     - fail-closed mit klarer Blocker-Meldung.
   - Lokaler Fallback bleibt unveraendert getrennt:
     - nur bei explizitem `preferredPreviewMode: "local"`.

2. `hooks/previewHelpers.ts`
   - Neuer Helper `isLegacyPreviewOperatorModeEnabled()` kapselt den Operator-Schalter.

3. Tests / Contracts
   - `__tests__/usePreview.serverContract.test.tsx` auf neuen Vertrag aktualisiert:
     - Standardpfad blockiert Legacy-Preview ohne Operator-Flag.
     - Operator-Flag erlaubt den Legacy-Compatpfad weiterhin explizit.
     - Netzwerk-/Admin-Key-Fehler bleiben im Operatorpfad fail-closed und ehrlich.
   - Neue Invariant `__tests__/patch615.previewLegacyOperatorBoundary.invariants.test.ts`:
     - erfordert den expliziten Operator-Guard im Preview-Hook.
   - `scripts/check_workflow_edge_contracts.sh` erweitert:
     - verankert den neuen Operator-Guard-Text im Preview-Hook.

## Ergebnis / Vertrag ab Patch 615

- **Normaler Client-/Preview-Flow (`supabase`)**:
  - nutzt keinen stillen Legacy-Admin-Key mehr,
  - blockiert ehrlich, solange nur Legacy-`save_preview` verfuegbar ist.
- **Expliziter Operator-/Maintenance-Flow**:
  - bleibt moeglich, aber nur mit bewusst gesetztem Operator-Flag.
- **Local Dev-Fallback**:
  - bleibt separat und explizit (`preferredPreviewMode: "local"`).

## Bekannter Restpunkt

Die Edge-Route `save_preview` selbst bleibt weiterhin auf dem Legacy-Admin-Secret-Vertrag (`K1W1_EDGE_ADMIN_KEY`).
Dieser Patch trennt den Clientvertrag fail-closed und explizit, ohne den Serverpfad in einen grossen Architekturumbau zu ziehen.
