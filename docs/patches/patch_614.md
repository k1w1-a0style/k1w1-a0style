# Patch 614: Build-Screen-Filter ohne irrefuehrenden Full-List-Fallback

## Problem

Im Build-Screen gab es fuer Workflow-Runs eine falsche Fallback-Logik:

- Bei aktivem Profilfilter (`development|preview|production`) und **null Treffern** fiel die UI intern auf die unfiltrierte Gesamtliste zurueck.
- Dadurch wirkte der Filterzustand irrefuehrend "nicht leer", obwohl fachlich keine passenden Builds existierten.

Konkret lag der Fehler in `useEnhancedBuildScreen` als Rueckfall:

- `return list.length > 0 ? list : runs`

## Aenderung

1. **Filterlogik fail-honest gemacht**
   - Neue Helper-Datei `runFilterState.ts` kapselt die Run-Filterung.
   - Aktiver Filter liefert jetzt strikt nur echte Treffer.
   - Bei null Treffern bleibt das Ergebnis korrekt `[]` (kein Rueckfall auf `runs`).

2. **Ehrlicher Empty State**
   - Fuer den aktiven Filterfall mit null Treffern wird explizit angezeigt:
     - `Keine Builds für dieses Profil gefunden (Filter: <profil>).`
   - Dadurch keine stillen "wenn leer dann alle"-Defaults mehr.

3. **Tests/Invariants nachgezogen**
   - Neuer Unit-Test `__tests__/runFilterState.test.ts` deckt ab:
     - aktiver Profilfilter + null Treffer => `[]`
     - `all`-Filter => unveraenderte Gesamtliste
     - Empty-State-Text nur im relevanten Nulltreffer-Filterfall
   - `__tests__/invariants.selection.test.ts` ergaenzt:
     - alter Fallback-String darf nicht mehr existieren
     - Hook muss den neuen Filter-Helper verwenden

## Ergebnis / Vertrag ab Patch 614

- **Ohne aktiven Filter (`all`)**: Gesamtliste wie bisher.
- **Mit aktivem Filter + Treffern**: nur passende Runs.
- **Mit aktivem Filter + null Treffern**: leere Liste + ehrlicher Empty State.
