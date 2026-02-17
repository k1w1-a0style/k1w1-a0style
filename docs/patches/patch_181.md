# Patch 181: CI Lite Progress + Step Feedback

## Änderungen

### CI Lite (Modal)
- Progress-Bar mit Prozentanzeige (heuristisch, aber stabil): Dispatch → Run gefunden → ESLint → Typecheck → Done.
- Subtile Shimmer-Animation auf der Progress-Bar während die Checks laufen.
- Kompaktes Status-Feedback (Dots + Spinner + Bar) im „ratter/ratter“ Style.

## Verifikation
1. **CI Lite** starten → Progress springt auf „Dispatch…“ und bewegt sich weiter.
2. Während ESLint/Typecheck laufen: Shimmer sichtbar, Prozent steigt.
3. Nach Abschluss: Progress = **100%**, Ergebnis zeigt ✅/❌ wie bisher.
