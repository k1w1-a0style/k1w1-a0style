# TODO

Stand: **2026-02-10**

## ✅ Done (CodeScreen)
- WebView-Editor (ohne gravierende UI-Änderung)
- RN↔WebView Bridge stabilisiert
- Focus-Tracking + Sync-Fix (keine Cursor-Sprünge durch externe Updates)
- Injection-Härtung beim Initialisieren des Editor-Inhalts
 - WebCodeEditor CSS Textfarbe fix (kein [object Object])
- `isDirty` vereinheitlicht (Hook + UI, inkl. Preview)
- TXT-Export stabil (expo-file-system typings kompatibel)
- QoL:
  - Duplicate-Kollisionen verhindern
  - Dateiendung-Regeln (kein blindes `.tsx` für `Dockerfile`, `.env`, usw.)
  - Clipboard `await` + Fehlerhandling
  - SyntaxErrorBar stabile Keys (ohne fileName/column)

## 🔧 Optional / Tech-Debt (CodeScreen)
- `useCodeScreen` später in kleinere Hooks splitten (Lesbarkeit/Testbarkeit).
- Performance (nur falls spürbar): Syntax-Validation weiter optimieren/auslagern.
- WebView Editor: nur wenn nötig – Undo/Redo UX weiter polishen (Icons/States), ohne großes Layout-Redo.

## PATCH 37 (cleanup + handoff)

✅ Fixes applied:
- CodeScreen: removed unused `TextInput` import in `EditorBody.tsx`
- CodeScreen: expanded extensionless allowlist for new files (Dockerfile/Makefile + LICENSE/NOTICE/README)
- CodeScreen: removed optional `textSecondary` dep churn in `WebCodeEditor.tsx` (no UI change)
- Docs: added new-chat handoff prompt + patch notes

🟡 Still open (CodeScreen tech-debt):
- `useCodeScreen` is a large “god hook” (refactor optional)
- Validator false positives / bracket counting improvements
- Syntax validation still runs on JS thread (acceptable for now)

## PATCH 38 (typing + docs hygiene)

✅ Fixes applied:
- CodeScreen: `gap: ... as any` entfernt (nutzt jetzt `types/react-native-gap.d.ts`).
- Docs: stray `docs_PATCH_28_NOTES.md` → `docs/patches/PATCH_28_NOTES.md` verschoben.
- Docs: unnötiges ZIP aus `docs/patches/artifacts/` entfernt.

🟡 Still open (optional tech-debt):
- `useCodeScreen` ist groß (Refactor in kleinere Hooks optional).
- Syntax-Validation läuft im JS-Thread (ok, solange keine UI-Lags).
