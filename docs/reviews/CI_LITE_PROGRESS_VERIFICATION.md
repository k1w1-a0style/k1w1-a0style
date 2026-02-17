# CI Lite Progress Verification (Patch 181)

## Expected
- CI Lite Modal zeigt eine Progress-Bar + Prozent.
- Während `dispatching` / `logsLoading` / `in_progress`: Shimmer-Animation sichtbar.
- Prozent/Label wechselt grob: Dispatch → Run → ESLint → Typecheck → Done.
- Keine Änderung an bestehender Logik (Dispatch, Polling, Results, Patch Apply).

## Steps
1. App starten, Repo/Branch gesetzt.
2. CI Lite Icon antippen.
3. Beobachten:
   - Progress erscheint direkt.
   - Während Check läuft: Shimmer bewegt sich.
4. Auf Erfolg/Fehler warten:
   - Progress endet bei 100%.
   - Ergebnis zeigt ✅ OK oder ❌ Fehler.

## Notes
- Prozent basiert auf Step-Heuristik (kein exaktes GitHub-Timing), dafür UI-stabil.
