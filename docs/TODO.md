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
- Type-Cleanup:
  - `gap` RN-Types per global `.d.ts` ergänzen statt überall `as any`.
  - expo-file-system Typen ggf. lokal ergänzen (statt `any`).
- Performance (nur falls spürbar): Syntax-Validation weiter optimieren/auslagern.

## ➡️ Next: Preview
1) **PreviewScreen** komplett fertig machen (Funktionalität vor UI/Polish).
2) **PreviewFullscreen** danach.

## UI/UX Polish (ganz zum Schluss)
- Einheitliche Optik über alle Screens + kleine Grafik-/Spacing-Fixes.

---

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
- `expo-file-system` typing cleanup (remove `any`) + RN `gap` typing polish
