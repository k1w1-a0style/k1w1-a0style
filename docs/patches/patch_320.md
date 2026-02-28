# Patch 320: Fix-List Fortschritt (Logger/API-Key-Masking Review) + TODO-Sync

## Kontext
Weiterer Punkt aus der offenen Fix-Liste abgearbeitet: schnelle Verifikation von bereits adressierten Logger-/Masking-Themen und anschließende TODO-Synchronisierung.

## Änderungen
- `docs/PROJECT_TODO.md`
  - Logger/no-console Optionalpunkt auf erledigt gesetzt (Referenz auf bestehende Umsetzung + diesen Review-Patch).
  - Logger-Migrationspunkt als abgeschlossen markiert (Hotspot-Bereiche sind bereinigt).
  - API-Key-Masking-Review als abgeschlossen markiert (UI-Callsites nutzen `lib/apiKeyMasking.ts`).

## Ergebnis
- Die Fix-Liste in `docs/PROJECT_TODO.md` ist konsistenter mit dem aktuellen Code-Stand.
- Verbleibende offene Punkte sind klar sichtbar (Shim-Migration, `any`-Reduktion, Observability).
