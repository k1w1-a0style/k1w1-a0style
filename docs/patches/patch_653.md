# Patch 653 - Planungsdurchlauf (naechste safe helper-first Kandidaten)

## Ziel
- Einen zusaetzlichen kleinen Durchlauf fuer den Refactor-Plan machen, ohne Runtime-Verhalten zu aendern.
- Die besten Kandidaten fuer denselben helper-first Stil konkret und priorisiert festhalten.

## Ergebnis (priorisierte Kandidaten)
1. **Connections**: Alert-/Hinweis-Textpfad in `useConnectionsScreen.ts` als `resolveConnectionsAlertNotice(...)` extrahieren.
2. **Build**: Statuslabel-/Badge-Mapping in `useEnhancedBuildScreen` in einen reinen Helper verschieben.
3. **Diagnostic**: kleinen Anzeige-Formatter (Issue-Subtitle/Result-Label) in `useDiagnosticFixRunner` helper-first auslagern.

## Leitplanken
- Keine Auth-/Dispatch-/Polling-/Persistenz-Umbauten.
- Nur pure Mapping-/Formatter-Extrakte mit fokussierten Tests.
- Reihenfolge bewusst klein halten (15 -> 16 -> 17).

## Verifikation
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
