# Patch 105 — CodeScreen Hardening (Save/Delete/Explorer/Modals)

Datum: 2026-02-13

## Summary
Dieses Patch setzt bestätigte Findings aus dem CodeScreen-Review um (Fokus: **Async-Korrektheit**, **UX-Konsistenz**, **kleine Robustheits-Fixes**).

## Änderungen

### Kritisch
- **Save**: `await updateProjectFiles(...)` beim Speichern; Erfolgsmeldung erst nach Persist.  
  _Datei_: `screens/CodeScreen/hooks/useFileEditor.ts`
- **Folder-Delete**: Deletes werden deterministisch awaited (keine N “fire-and-forget” Deletes).  
  _Datei_: `screens/CodeScreen/hooks/useFileActions.ts`
- **Folder-Delete Cleanup**: Wenn `selectedFile` im gelöschten Ordner lag → `selectedFile=null` + `editingContent=""`.  
  _Datei_: `screens/CodeScreen/hooks/useFileActions.ts`
- **FileTree**: Leere Ordner werden korrekt gefunden (Unterscheidung: *nicht gefunden* vs *gefunden, leer*).  
  _Datei_: `components/FileTree.ts`

### Hoch / Mittel
- **FileActionsModal**: State-Reset bei reopen (`newName`, `selectedFolder`, toggles).  
  _Datei_: `components/FileActionsModal.tsx`
- **CreationDialog**: State-Reset bei reopen (`name/type/error`).  
  _Datei_: `components/CreationDialog.tsx`
- **Explorer**: `selectAllFiles` scoped auf aktuellen Ordner; `toContentString` Duplikat entfernt.  
  _Datei_: `screens/CodeScreen/hooks/useFileExplorer.ts`
- **ImageViewer**: Dateigröße korrigiert (Base64 overhead + Prefix strip).  
  _Datei_: `screens/CodeScreen/components/ImageViewer.tsx`

### Niedrig
- **syntaxValidator**: `catch (e: unknown)` statt `any`.  
  _Datei_: `utils/syntaxValidator.ts`

## Verifikation
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent` ✅

