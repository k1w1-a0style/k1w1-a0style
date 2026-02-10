# CodeScreen Critical Review

**Datum:** 2026-02-10

## Kurzfazit

- Die aktuelle CodeScreen-Architektur ist bereits modularisiert (Editor/Explorer/Actions) und insgesamt gut lesbar.
- Es gibt jedoch mehrere **Correctness-Lücken** in asynchronen Dateiaktionen (insbesondere Erfolgs-Feedback trotz möglichem Fehlschlag).
- Der unsaved-changes Schutz ist nur auf interne UI-Aktionen begrenzt; ein Navigation-Guard auf Screen-Ebene fehlt.
- Der WebView-Bridge-Parser ist deutlich gehärtet (Schema + Payload-Limit + Sanitizing), aber die WebView-Konfiguration bleibt an einigen Stellen permissiv.
- Bei großen Dateien bleiben UI-Stalls möglich, da zentrale Validierung weiterhin synchron auf dem JS-Thread läuft.
- Typ- und API-Verträge sind nicht überall konsistent (z. B. Promise/void-Signaturen), was spätere Fehler begünstigen kann.
- Testseitig ist Bridge-Validation gut abgedeckt, aber Hook-/Flow-Tests für die risikoreichsten Pfade fehlen weitgehend.

## Findings

| ID | Severity | Bereich | Kurzbeschreibung | Datei:Zeile |
|---|---|---|---|---|
| F-001 | P1 | Correctness / UX | Erfolgs-Alert bei Ordner-Erstellung ohne Erfolgsgarantie (`createFile` nicht awaited) | `screens/CodeScreen/hooks/useFileActions.ts:318-328` |
| F-002 | P1 | Correctness / UX | Erfolgs-Alert bei Duplizieren ohne Erfolgsgarantie (`createFile` fire-and-forget) | `screens/CodeScreen/hooks/useFileActions.ts:248-278` |
| F-003 | P1 | State-Drift | `selectedFile`/`editingContent` können von `ProjectContext` driften (Snapshot statt Source-of-Truth) | `screens/CodeScreen/hooks/useFileEditor.ts:87-100`, `179-184` |
| F-004 | P1 | Unsaved-Changes / Navigation | Kein globaler Navigation-Guard (nur Back-Button im Header + interne Aktionen) | `screens/CodeScreen/index.tsx:94-120`, `screens/CodeScreen/hooks/useFileEditor.ts:198-228` |
| F-005 | P2 | Performance | Syntaktische Validierung läuft weiterhin synchron auf JS-Thread (auch beim Speichern) | `screens/CodeScreen/hooks/useFileEditor.ts:130-139`, `152-177` |
| F-006 | P2 | Security Hardening | WebView `originWhitelist={['*']}` ist unnötig weit; Navigation wird zwar gefiltert, bleibt aber defensiv schwach | `screens/CodeScreen/components/WebCodeEditor.tsx:325-338` |
| F-007 | P2 | Performance / Robustheit | TXT-Export ohne Byte-/Datei-Limits (String-Konkatenation im Speicher) | `screens/CodeScreen/hooks/useFileExplorer.ts:110-134` |
| F-008 | P3 | Typing / API Contract | Interface deklariert `void`, Implementierung ist `async` (Promise) bei Rename/Move/Create | `screens/CodeScreen/hooks/types.ts:62-67`, `screens/CodeScreen/hooks/useFileActions.ts:180-235`, `280-316` |

---

## F-001 – Ordner-Erstellung meldet Erfolg auch bei Fehlschlag

### Problem
`handleCreateFolder` ruft `createFile(`${fullPath}/.gitkeep`, "")` ohne `await` auf und zeigt direkt danach `Alert.alert("✅ Erfolg", ...)` an.

### Impact
- Nutzer können eine Erfolgsmeldung sehen, obwohl der Ordner nicht angelegt wurde (z. B. Pfadpolicy verletzt, Validation-Fehler, Race).
- Führt zu Vertrauensverlust in die UI und erschwertes Debugging („Folder wurde angeblich erstellt, ist aber nicht da“).

### Repro-Szenario
1. Ordnername wählen, der durch Pfad-Policy blockiert wird (abhängig von `validateFilePath`/Config).
2. Erstellen auslösen.
3. Es kann trotzdem ein Erfolgshinweis erscheinen, obwohl die Anlage scheitert.

### Empfehlung
- `handleCreateFolder` auf `async` umstellen und Ergebnis von `createFile` verlässlich auswerten (z. B. bool/Result-Objekt aus Context-Funktion).
- Erfolgsmeldung ausschließlich bei bestätigtem Erfolg zeigen; ansonsten konsistente Fehleranzeige.

## F-002 – Duplizieren meldet Erfolg auch bei Fehlschlag

### Problem
`handleDuplicateFile` ruft `createFile(candidate, actionTargetFile.content)` ohne `await` auf und zeigt sofort `✅ Dupliziert`.

### Impact
- False positives in der UI.
- In Randfällen (Validation-Fehler, ggf. Policy-Restriktionen) scheint ein Duplicate erstellt, obwohl keines existiert.

### Repro-Szenario
1. Datei mit Pfad/Name duplizieren, der durch Policy/Validator geblockt wird.
2. UI zeigt dennoch „Dupliziert“.
3. In Explorer fehlt die Datei.

### Empfehlung
- `handleDuplicateFile` als `async` behandeln und auf ein explizites Erfolgssignal von `createFile` warten.
- Kollisionsbehandlung beibehalten, aber „Erfolg“ erst nach bestätigtem Write.

## F-003 – Potenzieller State-Drift zwischen Editor-State und ProjectContext

### Problem
`selectedFile` wird als lokales Objekt-Snapshot gehalten. `isDirty` vergleicht `editingContent` mit `selectedOriginalContent` aus genau diesem Snapshot.
Wenn dieselbe Datei parallel über andere Flows im `ProjectContext` geändert wird, wird der Editorzustand nicht mitgezogen.

### Impact
- Falsche Dirty-Anzeige möglich (false negative/positive je nach Reihenfolge).
- Speichern könnte unerwartet ältere Inhalte überschreiben („last writer wins“ ohne Konflikthinweis).

### Repro-Szenario
- Datei A ist im Editor geöffnet.
- Externer Prozess/Action aktualisiert Datei A in `projectData.files`.
- Editor bleibt beim alten Snapshot; Dirty-Logik basiert nicht auf aktuellem Context-Stand.

### Empfehlung
- Für geöffnete Datei den Source-of-Truth über `projectData.files` auflösen (per Pfad), nicht über statisches Snapshot-Objekt.
- Optional: Konfliktindikator „Datei wurde extern geändert“ + Merge/Reload-Flow.

## F-004 – Unsaved-Changes nur partiell abgesichert

### Problem
Unsaved-Dialoge existieren bei Header-Back und internen Item-Aktionen, aber es fehlt ein Navigation-Guard für echte Screen-Wechsel (Stack back gesture, Tab-Wechsel, Hardware back je nach Navigator-Konfiguration).

### Impact
- Datenverlust möglich bei Navigation außerhalb der explizit abgefangenen Buttons.

### Repro-Szenario
- Datei ändern, nicht speichern.
- Screen über Navigator-Geste oder externen Navigationsauslöser verlassen.
- Kein einheitlicher Confirm-Flow garantiert.

### Empfehlung
- `beforeRemove`/equivalenten Navigator-Guard auf Screen-Ebene nutzen und auf `isDirty` binden.
- Einen zentralen Confirm-Flow verwenden (statt separater Alert-Implementierungen), damit Verhalten konsistent bleibt.

## F-005 – Validierung kann bei großen Dateien weiterhin den JS-Thread blockieren

### Problem
Live-Validierung ist zwar debounce/deferred, bleibt aber synchron im JS-Thread (`validateSyntax`, optional `validateCodeQuality`). Beim Speichern wird `validateSyntax` immer synchron ausgeführt.

### Impact
- Potenzielle UI-Ruckler/Freeze bei großen Dateien oder komplexen Regex-Pfaden.
- Schlechtere Eingabelatenz und Save-Delay.

### Repro-Szenario
- Große TS/JS-Datei öffnen (hoher Import-/Zeilenumfang).
- Schnell tippen oder speichern.
- Spürbare Lags möglich, obwohl Debounce vorhanden ist.

### Empfehlung
- Save-Validation ebenfalls größenabhängig drosseln/vereinfachen.
- Optional: schrittweise Validierung (light checks live, heavy checks explizit) oder Auslagerung in Background-Task/Worker-ähnlichen Kanal.

## F-006 – WebView-Konfiguration defensiv noch zu offen

### Problem
`originWhitelist={['*']}` ist sehr weit. Zwar blockt `onShouldStartLoadWithRequest` Fremdnavigationen, aber Default-Policy bleibt unnötig permissiv.

### Impact
- Hardening-Level geringer als nötig.
- Bei Plattform-/Implementierungsunterschieden kann permissive Whitelist Angriffsfläche vergrößern.

### Empfehlung
- Whitelist auf benötigte Schemes einschränken (z. B. `about:blank`, `data:`-Flow gezielt).
- Zusätzliche WebView-Sicherheitsflags (plattformabhängig) prüfen und dokumentieren.

## F-007 – TXT-Export ohne harte Größenlimits

### Problem
Export baut den gesamten Inhalt als einen großen String im Speicher auf und schreibt ihn anschließend. Es gibt keine expliziten Gesamtlimits für Dateianzahl/Bytes in diesem Flow.

### Impact
- Speicher-/Performanceprobleme bei großen Projekten.
- Potenzielle OOM-Risiken auf schwächeren Geräten.

### Empfehlung
- Vorab Gesamtgröße schätzen und harte Limits + Nutzerhinweis einführen.
- Optional chunked/stream-artiger Aufbau statt monolithischer String-Konkatenation.

## F-008 – Typvertrag nicht deckungsgleich (void vs Promise)

### Problem
`UseCodeScreenReturn` deklariert mehrere Handler als `void`, Implementierungen sind `async` (Promise-returning). Das ist in JS oft tolerierbar, aber als API-Vertrag inkonsistent.

### Impact
- Erschwert korrekte Aufruferlogik (z. B. UI wartet auf Abschluss, kann aber laut Typ nicht).
- Potenzielle „floating promise“-Probleme bei zukünftigen Aufrufern.

### Empfehlung
- Typen konsistent an tatsächliches Verhalten angleichen (`Promise<void>` bzw. Result-Typ).
- Für UI-Flows mit Erfolg/Misserfolg lieber explizite Result-Objekte statt impliziter Fire-and-forget-Handler.

---

## Quick Wins (max. 10)

1. `handleCreateFolder`/`handleDuplicateFile` auf echten Erfolgsstatus umstellen (kein vorzeitiger Erfolgs-Alert).
2. Einheitlichen `Result`-Rückgabevertrag für `createFile`/`renameFile`/`deleteFile` definieren.
3. Zentralen Unsaved-Changes-Navigator-Guard auf Screen-Level ergänzen.
4. Save-Validation für sehr große Dateien auf „light mode“ reduzieren.
5. `originWhitelist` in WebView minimal halten statt `*`.
6. Export-Flow mit max Gesamtgröße/Dateianzahl absichern.
7. `UseCodeScreenReturn`-Signaturen an async Realität angleichen.
8. Optionalen „extern geändert“-Hinweis für aktive Datei einführen.

## Optional Improvements

- Gemeinsame Helper-Schicht für alle Dateiaktionen mit transaktionalem Ergebnis (`ok`, `reason`, `updatedPath`).
- Beobachtbarkeit: Logging-Marker für Action-Failures (nur lokal/dev, ohne Secrets).
- Performance-Metriken (Editor-Lag, Save-Latenz, Validation-Dauer) als Debug-Statistik in Dev-Build.

## Test Suggestions

1. **Hook-Test:** `handleCreateFolder` zeigt Erfolg **nur** wenn `createFile` tatsächlich erfolgreich war.
2. **Hook-Test:** `handleDuplicateFile` bei validierungsbedingtem `createFile`-Fail → kein Success Alert.
3. **Integration-Test:** Unsaved Änderungen + Navigator-`beforeRemove` → Confirm-Dialog + korrektes Verhalten für Cancel/Discard/Save.
4. **State-Drift-Test:** Externe `projectData.files`-Änderung bei offenem Editor erzeugt Konflikt-/Sync-Verhalten (definiert und testbar).
5. **Performance-Regression-Test:** große Datei (z. B. 300k+ chars) speichert/validiert ohne UI-blockierende Nebenwirkungen (mindestens Timing-Grenze als Heuristik).
