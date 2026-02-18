# PATCH 61 NOTES

Datum: 2026-02-11  
Bereich: DiagnosticScreen

## Fixes

- F-001: Batch-Fix Dedupe ist jetzt content-sensitiv (`patchFingerprint`) → keine „falschen Duplikate“ mehr.
- F-002: Preferences Save/Load Race behoben (Hydration-Gate).
- F-003: Async Unmount-Safety für Progress-Updates gehärtet.
- F-004: IssuesFilter Contract bereinigt ("info" entfernt, Hook/Type konsistent).
- F-005: Progressive Results Updates throttled (Performance, weniger Re-Renders).

## Tests

- Unit: `patchFingerprint` unterscheidet gleiche Struktur / different Content.
- Hook: Preferences speichern erst nach Hydration.

## UI

- Keine optischen Änderungen. Nur Verhalten/Robustness.
