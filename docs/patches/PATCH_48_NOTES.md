# PATCH 48 — CodeScreen Mini-Hardening Hotfix

Stand: 2026-02-10

## Kontext
Patch 47 hat Focus-Sync + A11y + typed TXT-Export eingeführt. In der Praxis gab es dabei zwei kleine Build-Blocker:
- `styles.toolBtnDisabled` wurde verwendet, aber nicht im StyleSheet definiert (TS-Error).
- ESLint-Regel `import/namespace` hat `FileSystem.documentDirectory/cacheDirectory` als unbekannt markiert (False-Positive je nach Resolver).

## Änderungen
### WebCodeEditor
- `toolBtnDisabled` Style ergänzt.

### TXT Export (Selection Mode)
- Wechsel auf named imports aus `expo-file-system` (`documentDirectory`, `cacheDirectory`, `writeAsStringAsync`).
- Keine Verhaltensänderung, nur Typing/Lint-Kompatibilität.

## Dateien
- `screens/CodeScreen/components/WebCodeEditor.tsx`
- `screens/CodeScreen/hooks/useFileExplorer.ts`
- `docs/patches/PATCH_48_NOTES.md`
- `PROJECT_CHECKLOG.md`
