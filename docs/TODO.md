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
- Typing-Hygiene:
  - `gap` RN-Types per global `.d.ts` ergänzt (kein `as any` mehr nötig)
  - `expo-file-system` Typen lokal ergänzt (kein `any`-Cast)

## ✅ Done (Maintenance)
- Patch-Skripte/Docs bereinigt und Handoff-Prompt angelegt.

## 🔧 Optional / Tech-Debt (CodeScreen)
- `useCodeScreen` später in kleinere Hooks splitten (Lesbarkeit/Testbarkeit).
- Type-Cleanup:
  - `gap` RN-Types per global `.d.ts` ergänzen statt überall `as any`.
  - expo-file-system Typen ggf. lokal ergänzen (statt `any`).
- Performance (nur falls spürbar): Syntax-Validation weiter optimieren/auslagern.

## ⏭️ Next (CodeScreen)
- Nichts Kritisches offen.
- Optional (nur wenn es in der Praxis wehtut): Syntax-Validation/Quality-Checks in Worker/Task auslagern.

## ➡️ Next: Preview
1) **PreviewScreen** komplett fertig machen (Funktionalität vor UI/Polish).
2) **PreviewFullscreen** danach.

## UI/UX Polish (ganz zum Schluss)
- Einheitliche Optik über alle Screens + kleine Grafik-/Spacing-Fixes.
