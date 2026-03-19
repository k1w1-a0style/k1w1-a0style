# Patch 481 — Schritt 5: Build-/Deploy-Readiness gegen CI-Lite-SHA angeglichen

## Kontext

Für Schritt 5 wurden nur diese Punkte erneut geprüft:

- S10
- E5
- E6
- E7
- B6

Der aktuelle Stand ist bereits stark gehärtet. Deshalb galt hier ausdrücklich: nichts künstlich wieder öffnen, sondern nur reale Restpunkte im aktuellen Code bestätigen oder sauber verwerfen.

## Bewertung der geprüften Punkte

- **S10**: **nicht bestätigt** — im aktuellen Repo ließ sich kein neuer produktiver Defekt im zugehörigen Scope reproduzieren oder aus dem aktuellen Codepfad ableiten.
- **E5**: **nicht bestätigt** — Diagnostics bleiben bereits repo-/branch-scoped Build-Blocker mit Legacy-Fallback; kein neuer Drift zwischen Diagnostic und Build-Gate festgestellt.
- **E6**: **nicht bestätigt** — der Credentials Wizard persistiert Signing-Key-Status bereits projekt-/repo-scoped mit Legacy-Fallback; im aktuellen Stand kein neuer Scope-Leak bestätigt.
- **E7**: **nicht bestätigt** — `startBuildJob(...)` nutzt kein altes Repo-/Branch-Fallback mehr; der Service bleibt bewusst strikt auf der verlinkten Auswahl.
- **B6**: **bestätigt** — Build-Screen und One-Click-Deploy prüften CI-Lite zwar auf Repo/Branch/Freshness, aber noch nicht auf denselben SHA-Abgleich wie `startBuildJob(...)`. Dadurch konnte die UI grün wirken, obwohl der eigentliche Build-Start anschließend korrekt mit SHA-Mismatch blockiert hätte.

## Umsetzung

- Neue Readiness-Helferfunktion `readBuildReadinessState(...)` ergänzt, die Diagnostic-Status, CI-Lite-Flags, Freshness **und** den SHA-Abgleich gegen den aktuellen Branch-HEAD gemeinsam bewertet.
- `useBuildPreconditions(...)` nutzt jetzt denselben erweiterten Readiness-Status für die Build-UI.
- `useOneClickDeploy(...)` nutzt denselben erweiterten Readiness-Status für seinen Vorab-Check.
- Fokussierte Regressionen ergänzt:
  - `__tests__/buildReadinessState.test.ts`
  - `__tests__/oneClickDeploy.test.tsx` (SHA-Mismatch-Fall)

## Verifikation

- `npm run test:silent -- --runInBand __tests__/buildReadinessState.test.ts __tests__/oneClickDeploy.test.tsx lib/__tests__/buildStartService.integration.test.ts`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Ergebnis

Nur der bestätigte Drift zwischen UI-Readiness und hartem Build-Gate wurde angepasst. Die übrigen Schritt-5-Punkte wurden bewusst **nicht** künstlich zu technischen Fixes umgedeutet.
