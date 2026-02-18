# PATCH 62 — DiagnosticScreen Typecheck Fix

**Datum:** 2026-02-11  
**Scope:** Follow-up auf Patch 61 (DiagnosticScreen Hardening)

## Fixes

- **TS Fix:** `useDiagnosticScreen` Pipeline-Mapping nutzt jetzt `fixHint/details` statt nicht-existierendem `c.message`.
- **API Contract Fix:** `IssuesFilter` konsistent (Option 1 aus Review): `"info"` entfernt und Typen/Props vereinheitlicht.

## Verhalten / UI

- **Keine Optik-Änderung** (nur Type-Safety / Contract-Cleanup).
