# Build Screen Critical Review

**Datum:** 2026-02-10

## Kurzfazit

- Der Build-Flow ist funktional strukturiert (Hook + Sections), aber hat mehrere Race-/Lifecycle-Risiken bei asynchronen Aktionen.
- Besonders kritisch: `onStartBuild` hat keinen harten Reentrancy-Guard, wodurch schnelle Doppeltaps potenziell mehrere Builds starten können.
- Polling/Refresh ist vorhanden, aber Offline-/Retry-Strategien und AppState-Steuerung sind inkonsistent (Build-Status in `ProjectContext` berücksichtigt AppState, Log-Polling nicht).
- Typisierung ist im Kern vorhanden, wird aber an zentralen Stellen mit `any` umgangen, wodurch API-Drift spät erkannt wird.
- Security-Härtung ist teilweise vorhanden (Repo/Branch-Checks), aber URL-Handling und potenzielle Sensitivdaten in Logs sind nicht durchgängig abgesichert.
- Es wurden keine Build-Flow-Tests gefunden; dadurch hohes Regressionsrisiko bei genau den race-/async-lastigen Pfaden.

## Findings

| ID | Severity | Bereich | Kurzbeschreibung | Datei:Zeile |
|---|---|---|---|---|
| BS-01 | P1 | Correctness / Race | Build-Start ohne harten Reentrancy-Guard; Doppeltap kann mehrere `startBuild`-Aufrufe auslösen. | `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts:230-255` |
| BS-02 | P1 | Correctness / Lifecycle | Async-Handler setzen State nach `await` ohne Mount-Guard (`onStartBuild`, `onSaveLinkedRepo`, `onRefresh` indirekt). | `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts:220-279` |
| BS-03 | P2 | Correctness / UX | ETA-Berechnung ist nicht „live“: `Date.now()` wird nur bei `buildStartTime`-Änderung ausgewertet, nicht per Tick. | `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts:325-335` |
| BS-04 | P2 | Correctness / Input Validation | Repo-Validierung ist inkonsistent: `canFetch` prüft nur `/`, akzeptiert damit ungültige Formen (`owner/repo/extra`). | `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts:164-175, 181-218` |
| BS-05 | P2 | Security / URL Hardening | Ein Run-Link wird direkt via `Linking.openURL` geöffnet (ohne `canOpenURL`/Scheme-Guard wie in `openRun`). | `screens/EnhancedBuildScreen/components/LogsAnalysisSection.tsx:59-63` |
| BS-06 | P2 | Performance / Robustness | Log-Polling läuft alle 5s; keine adaptive Backoff-/Offline-Strategie, kein AppState-Pause-Mechanismus im Hook selbst. | `hooks/useGitHubActionsLogs.ts:40, 207-241` |
| BS-07 | P2 | Typing / API Contract | Kritische Typaufweichungen (`as any`, `workflowRun: any`) erhöhen Risiko für stille Contract-Breaks. | `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts:81, 121`; `screens/EnhancedBuildScreen/components/LogsAnalysisSection.tsx:34` |
| BS-08 | P2 | Security / Data Exposure | Logs werden raw angezeigt/kopiert; keine Redaction sensibler Muster (Tokens/Keys/Authorization) vor UI/Clipboard. | `hooks/useGitHubActionsLogs.ts:141-169`; `components/BuildLogsModal.tsx:103-107, 221-229` |
| BS-09 | P2 | Testing | Keine dedizierten Tests für Build-Flow, Polling, Race Conditions, oder Error Paths gefunden. | `__tests__/` (keine Treffer für Build-Flow) |

---

## BS-01 – Build-Start ohne harten Reentrancy-Guard

**Problem**
`onStartBuild` setzt `buildLoading` erst im Handler und verlässt sich im Wesentlichen auf das Button-Disable im Render. Bei sehr schnellen Interaktionen kann der Handler mehrfach feuern, bevor der Disable-State sichtbar wirksam ist.

**Impact**
- Mehrere parallele Build-Triggers möglich.
- Inkonsistenter `currentBuild`-State / konkurrierende Alerts.
- Potenziell unnötige CI/EAS-Kosten.

**Repro-Szenario**
1. Build-Button mehrfach sehr schnell tippen (low-end device / JS-Thread load).
2. Prüfen, ob `startBuild` mehrfach ausgelöst wurde.

**Empfehlung**
- Im Hook einen synchronen Reentrancy-Guard via `useRef` ergänzen (früher Return, bevor `await startBuild`).
- Guard erst im `finally` zuverlässig zurücksetzen.
- Optional: dedizierte „in-flight action map“ für alle asynchronen UI-Aktionen.

## BS-02 – Async-State-Updates ohne Mount-Guard

**Problem**
Mehrere Async-Pfade setzen State (`setBuildLoading`, `setSavingRepo`, `setRefreshing`) nach `await`, ohne zu prüfen, ob die Komponente noch gemountet ist.

**Impact**
- React-Warnungen („state update on unmounted component“) je nach Timing.
- Schwer reproduzierbare UI-Inkonsistenzen bei schneller Navigation.

**Repro-Szenario**
1. Aktion starten (z. B. Build/Save/Refresh).
2. Sofort Screen verlassen.
3. Request endet später -> potenzielles State-Update nach Unmount.

**Empfehlung**
- Einheitlichen `isMountedRef`-Guard in `useEnhancedBuildScreen` einführen und in `finally`-Blöcken prüfen.
- Alternativ: cancellable abstractions pro Request.

## BS-03 – ETA wird nicht live aktualisiert

**Problem**
`elapsedMs` ist `useMemo`-basiert und hängt nur von `buildStartTime` ab. Ohne Ticker bleibt `Date.now()` effektiv statisch.

**Impact**
- ETA wirkt eingefroren oder springt nur bei externen Re-Renders.
- Schlechteres Vertrauen in Build-Progress-Anzeige.

**Empfehlung**
- Kleinen Tick-State (z. B. 1s) nur bei aktivem Build führen.
- ETA ausschließlich aus Status + `startedAt` + Tick ableiten.

## BS-04 – Repo-Validierung inkonsistent

**Problem**
`canFetch` verlangt nur, dass ein `/` enthalten ist; `owner/repo/extra` passiert. Danach werden `owner` und `repo` stumpf per `split('/')` aus den ersten zwei Segmenten verwendet.

**Impact**
- Unerwartete Requests gegen falsches Repo.
- Verwirrendes Verhalten zwischen „Save Repo“ und „Fetch Runs“.

**Empfehlung**
- Einheitliche zentrale Validator-Funktion für `owner/repo` (genau zwei Segmente, erlaubte Zeichen).
- Dieselbe Funktion in Save + Fetch + Logs nutzen.

## BS-05 – URL-Öffnung ohne konsistenten Guard

**Problem**
In `LogsAnalysisSection` wird `Linking.openURL` direkt aufgerufen. An anderen Stellen wird sauber über `openRun` mit `canOpenURL` gegangen.

**Impact**
- Inkonsistentes Fehlerverhalten.
- Potenziell unsichere/unerwartete Schemes bei kompromittierten Datenquellen.

**Empfehlung**
- Alle externen URL-Opens über die zentrale `openRun`-Funktion führen.
- Optional zusätzlich nur `https://github.com/...` erlauben, wenn fachlich möglich.

## BS-06 – Polling ohne adaptive Strategie

**Problem**
`useGitHubActionsLogs` pollt starr alle 5 Sekunden. Es gibt keine explizite Offline-Erkennung/Backoff/Jitter, und keine eigene AppState-Pause im Hook.

**Impact**
- Unnötige Requests bei schlechtem Netz/offline.
- Potenzielle Akku-/Datenlast.
- Fehlerrauschen in instabilen Verbindungen.

**Empfehlung**
- Exponential Backoff bei Fehlern + Reset bei Erfolg.
- Optional NetInfo-basierte Pause bei Offline.
- Optional AppState-Integration analog Build-Status-Polling.

## BS-07 – Typaufweichung an kritischen Stellen

**Problem**
`as any` für Build-Profile/Status und `workflowRun: any` hebeln den Type-Schutz aus.

**Impact**
- API-Änderungen fallen erst runtime auf.
- Höheres Risiko für stille UI-Fehler.

**Empfehlung**
- `workflowRun` konkret typisieren (aus Hook-Interface oder gemeinsamem Typmodul).
- `as any` entfernen und Guard-/Narrowing-Funktionen einsetzen.

## BS-08 – Raw Logs ohne Redaction

**Problem**
Logs werden raw angezeigt und in die Zwischenablage kopiert; es gibt keine Redaction von bekannten Secret-Mustern.

**Impact**
- Potenzielles Leaken von Tokens/Keys in UI, Screenshots, Clipboard.

**Empfehlung**
- Serverseitig bevorzugt, alternativ clientseitig eine Redaction-Pipeline für typische Muster (`Bearer`, `ghp_`, `x-k1w1-admin-key`, `Authorization`, JWT-Segmente etc.).
- Redaction sowohl für Preview-Liste als auch Modal/Clipboard anwenden.

## BS-09 – Fehlende Build-Flow-Tests

**Problem**
Es gibt keine erkennbaren Tests für Build-spezifische Interaktionen/Edgecases.

**Impact**
- Race-/Polling-Regressionen bleiben unentdeckt.
- Refactorings im Hook riskant.

**Empfehlung**
- Priorisierte Tests (siehe „Test Suggestions“) für die kritischsten Pfade ergänzen.

---

## Quick Wins (max. 10)

1. Einheitlichen `isMountedRef`-Guard für alle Async-Handler im Build-Screen-Hook verwenden.
2. Reentrancy-Guard für `onStartBuild` (und optional `fetchRuns`) ergänzen.
3. Direkten `Linking.openURL`-Call in `LogsAnalysisSection` durch `openRun` ersetzen.
4. Zentrale `parseAndValidateRepoFullName()` Utility einführen und überall nutzen.
5. ETA-Ticker im aktiven Build aktivieren, bei finalem Status stoppen.
6. Fehler-UX verbessern: Offline-spezifische Meldung + Retry-CTA statt generischer Fehlertexte.
7. Polling bei wiederholten Fehlern dynamisch verlangsamen (Backoff).
8. Log-Redaction vor Anzeige/Copy einführen.
9. `workflowRun` und Status-Objekte strikt typisieren.
10. Minimalen smoke-test für Build Start + Loading-State + Disable-Button erstellen.

## Optional Improvements

- Hook-Aufteilung: `useBuildActions`, `useWorkflowRuns`, `useBuildLogs` getrennt halten, um Verantwortlichkeiten klarer zu machen.
- Einheitliches Error-Objekt mit Code/Source/UserMessage statt nur String.
- Observability: interne Telemetrie-Events für Build Start/Fail/Retry (ohne sensitive Payload).
- Virtuelle Log-Liste bei größerer Log-Menge (falls künftig >500 Einträge nötig werden).

## Test Suggestions

1. **Race-Test `onStartBuild`**: Simuliere zwei schnelle Aufrufe, erwarte genau einen `startBuild`-Call.
2. **Unmount-Safety-Test**: Starte `fetchRuns`, unmounte sofort, stelle sicher: kein State-Update/Warning.
3. **Repo-Validator-Testmatrix**: `owner/repo` gültig; `owner/repo/extra`, `owner`, `/repo`, Leerstring ungültig.
4. **Polling-Behavior-Test**: `useGitHubActionsLogs` stoppt Polling bei `workflowRun.status = completed`.
5. **Security-Test Logs Redaction**: Eingehende Log-Zeilen mit Token-Mustern werden maskiert, nicht raw angezeigt/kopiert.
