# Patch 781: Snapshot-faithful rollback closure for Connections

## Ziel
Den verbliebenen Rollback-Widerspruch im Connections-Flow schließen:
- Rollback muss Snapshot exakt wiederherstellen.
- Nach erfolgreichem Restore dürfen keine nachgelagerten Save-Plan-Clears Side-States erneut löschen.

## Problem
Im bisherigen `restoreSnapshot(...)` wurden Side-States zuerst korrekt restauriert, danach aber je nach Plan erneut `clearEasConnectionState()` / `clearSupabaseConnectionState()` ausgeführt. Das konnte Snapshot-Zustand wieder überschreiben.

## Umsetzung (minimal, ohne Broad-Refactor)
- In `screens/ConnectionsScreen/hooks/useConnectionsSaveActions.ts` wurden die post-restore Clears aus `restoreSnapshot(...)` entfernt.
- Apply-Pfad bleibt unverändert: Clear-/Normalize-Logik wird weiterhin nur im Vorwärtspfad ausgeführt.

## Testschutz
- `__tests__/connectionsAndBackupRecoverable.invariants.test.ts` ergänzt:
  - Rollback-Block enthält keine post-restore Clear-Calls.
  - Apply-Block enthält weiterhin die erwartete Clear-Logik.

## Ergebnis
- Rollback ist snapshot-getreu.
- Apply bleibt fail-closed normalisierend.
- Kein nachträgliches Weglöschen restaurierter EAS-/Supabase-Side-States im Rollback.
