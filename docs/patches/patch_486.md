# Patch 486

## Titel
CI-Lite-Header hydriert jetzt konservativ aus passender Persistenz und zeigt Artifact-/Backchannel-Probleme klar getrennt vom Workflow-Fehler an.

## Was geändert wurde
- neue Helper-Logik `lib/ciLitePersistence.ts`, die repo-/branch-/sha-/freshness-passende CI-Lite-Persistenz gegen die aktuelle Selection prüft
- `useCiLiteWorkflow` hydriert den letzten plausiblen finalen Zustand beim Start/Reopen ohne neuen Workflow-Dispatch und ohne aktives Run-Tracking künstlich wieder zu öffnen
- `CiLiteModal` zeigt persistierten Abschluss-Hinweis sowie getrennte UI für `Workflow-/Run-Problem` vs. `Artifact-/Nachzug-Problem`
- Tests für positive/negative Persistenz-Hydrierung, Reopen ohne Redispatch und sichtbaren Artifact-Fehler ergänzt

## Warum
- der Header sollte beim App-/Screen-Start nicht unnötig auf idle zurückfallen, wenn eine passende frische CI-Lite-Wahrheit bereits vorliegt
- gleichzeitig durfte keine fremde oder veraltete Persistenz einen falschen „läuft noch“-/„alles grün“-Eindruck erzeugen
- `artifactError` wurde intern bereits geführt, war im UI aber für Nutzer nicht klar genug unterscheidbar

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
