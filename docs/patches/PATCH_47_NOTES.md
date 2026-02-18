# PATCH 47 — CodeScreen Mini-Hardening

Stand: 2026-02-10

## Ziele
- Focus-Tracking im WebCodeEditor so härten, dass externe Updates nach `blur` zuverlässig synchronisiert werden.
- Kleine A11y-Verbesserung für Undo/Redo.
- `expo-file-system` ohne `any`-Cast im TXT-Export.

## Änderungen
### WebCodeEditor
- Focus wird jetzt als React State gehalten (`isFocused`), nicht nur als Ref.
- Der Sync-Effect hängt an `isFocused` → wenn der Editor `blur` bekommt, wird ein ggf. ausstehendes externes `value` in den WebView gepusht.
- Undo/Redo Buttons haben `accessibilityLabel`/`accessibilityHint` und werden disabled, solange der Editor noch nicht ready ist.

### TXT Export (Selection Mode)
- `FileSystem.writeAsStringAsync` wird direkt genutzt.
- `documentDirectory/cacheDirectory` werden typ-sicher verwendet (kein `any`).

## Dateien
- `screens/CodeScreen/components/WebCodeEditor.tsx`
- `screens/CodeScreen/hooks/useFileExplorer.ts`
- `docs/TODO.md`
- `docs/patches/PATCH_47_NOTES.md`
- `PROJECT_CHECKLOG.md`
