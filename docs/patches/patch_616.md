# Patch 616: globale Warnungsunterdrueckung in App-Initialisierung minimiert

## Problem

In `App.tsx` wurden bislang mehrere globale LogBox-Warnungen pauschal unterdrueckt:

- `Require cycle:`
- `VirtualizedLists should never be nested`
- `Sending \`onAnimatedValueUpdate\` with no listeners registered.`

Die ersten beiden Muster sind zu breit/riskant, weil sie im Dev-Betrieb wichtige Architektur- und Render-Signale verstecken.

## Aenderung

1. **Globale Ignore-Liste verengt**
   - `Require cycle:` entfernt.
   - `VirtualizedLists should never be nested` entfernt.
   - Keine Verwendung von `ignoreAllLogs`.

2. **Bewussten Restpunkt klar dokumentiert**
   - Nur noch folgende Rule bleibt global:
     - `Sending \`onAnimatedValueUpdate\` with no listeners registered.`
   - In `App.tsx` ist jetzt direkt am Ignore-Eintrag dokumentiert:
     - warum die Regel aktuell akzeptiert ist (Reanimated-Dev-Noise),
     - dass sie eng begrenzt bleibt,
     - unter welcher Bedingung sie zu entfernen ist (sobald Upstream-/Library-Updates den Noise beseitigen).

3. **Invariant gegen Rueckdrift**
   - Neue Invariant `__tests__/patch616.logboxWarningVisibility.invariants.test.ts` sichert:
     - keine globalen Ignore-Strings fuer `Require cycle:` / `VirtualizedLists...`,
     - keine `ignoreAllLogs`-Rueckkehr,
     - verbleibende minimale Ignore-Rule ist vorhanden.

## Ergebnis / Vertrag ab Patch 616

- Dev-Warnungen mit Architektur-/Listenbezug sind wieder sichtbar.
- Globale Warnungsunterdrueckung bleibt auf ein bewusstes Minimum begrenzt.
- Verbleibende Unterdrueckung ist im Code nachvollziehbar dokumentiert und durch Invariant abgesichert.
