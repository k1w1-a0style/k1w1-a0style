# Patch 106 — DiagnosticScreen Hardening (applyPatch Consistency + Progress/Undo)

Datum: 2026-02-13

## Summary
Dieses Patch setzt bestätigte Findings aus dem DiagnosticScreen-Review um. Schwerpunkt ist **korrekte Patch-Anwendung ohne Phantom-State**, plus kleine UX/Robustheits-Fixes (Progress/Undo/Prefs).

## Änderungen

### Kritisch
- **applyPatch**: Delete-Fehler werden nicht mehr geschluckt (UPSERT löscht nicht) → verhindert File-Leichen und `projectRef`/`projectData` Divergenz.  
  _Datei_: `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts`
- **projectRef Shadow-State**: `projectRef.current.files` wird nur nach erfolgreichem Delete+Upsert aktualisiert (kein Phantom-State für Batch-Fixes).  
  _Datei_: `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts`

### Hoch
- **Undo All**: Busy-Guard + `finally` Cleanup (kein Doppel-Undo / keine parallel laufenden Undo-Ketten).  
  _Datei_: `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts`
- **Batch Progress**: `setFixStepIndex` auch für Apply-Steps (ProgressBar zählt schrittweise).  
  _Datei_: `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts`
- **HeaderStats**: Projektname aus `projectData?.name` statt `projectRef.current` (kein stale Name).  
  _Datei_: `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts`

### Mittel / Niedrig
- **Preferences**: AsyncStorage Read/Write Fehler werden geloggt (Warnung statt stilles Schlucken).  
  _Datei_: `screens/DiagnosticScreen/hooks/useDiagnosticPreferences.ts`
- **AUTOFIX_MAX**: Single-Source Constant (Export/Import) – kein dupliziertes Limit in UI.  
  _Datei_: `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts`, `screens/DiagnosticScreen/components/NonIssuesTabSection.tsx`
- **Cleanup**: `issueList` No-Op `useMemo` entfernt.  
  _Datei_: `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts`

## Verifikation
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent` ✅
