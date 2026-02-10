# DiagnosticScreen Critical Review

Datum: 2026-02-10

## Kurzfazit

- Der DiagnosticScreen ist funktional gut strukturiert (Hook-Split nach Responsibilities), aber es gibt einige konkrete Correctness-Risiken in Fix- und Preference-Flows.
- Das größte funktionale Risiko ist die Batch-Deduplizierung via `patchFingerprint`: unterschiedliche Patches können fälschlich als Duplikat behandelt und übersprungen werden.
- Die Async-Sicherheit ist teilweise vorhanden (`mountedRef`), aber nicht konsistent: einzelne State-Updates laufen weiterhin ohne Mount-Guard.
- Die Persistenz der Diagnostic-Preferences kann beim Initial-Load race-condition-bedingt gespeicherte Werte überschreiben.
- Security-Hardening ist grundsätzlich vorhanden (Sanitization + Path/Content-Validation), allerdings fehlt bei einigen Log-/Sync-Pfaden eine stärkere defensive Behandlung von Partial-Failure-Szenarien.
- Testabdeckung für kleine Utility-Hooks ist okay, aber kritische Pfade (Fix Runner, Upload/Cooldown, Pref-Restore-Races) sind praktisch ungetestet.

## Findings

| ID | Severity | Bereich | Kurzbeschreibung | Datei:Zeile |
|---|---|---|---|---|
| F-001 | P1 | Correctness | Batch-Dedupe kann unterschiedliche Patches als „gleich“ behandeln und legitime Fixes überspringen. | `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts:515-525`, `lib/diagnostics/fixSafety.ts:78-86` |
| F-002 | P1 | Correctness / State Restore | Preferences können beim Initialisieren durch den Save-Effekt mit Defaults überschrieben werden (Race zwischen Load und Debounced Save). | `screens/DiagnosticScreen/hooks/useDiagnosticPreferences.ts:56-130`, `screens/DiagnosticScreen/hooks/useDiagnosticPreferences.ts:132-174` |
| F-003 | P2 | Async Safety | Nicht alle State-Updates sind unmount-safe; `setProgressStage` wird in Async-Loops ohne Mount-Guard aufgerufen. | `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts:509`, `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts:513`, `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts:548` |
| F-004 | P2 | UX Correctness / Contract | Filter-Typ enthält `info`, UI bietet aber kein `info` an; Hook liefert dafür immer leeres Ergebnis. API/UI-Kontrakt ist inkonsistent. | `screens/DiagnosticScreen/hooks/useDiagnosticIssueFiltering.ts:6`, `screens/DiagnosticScreen/hooks/useDiagnosticIssueFiltering.ts:25`, `screens/DiagnosticScreen/components/IssuesTabSection.tsx:103-107` |
| F-005 | P2 | Performance | Sehr häufige progressive `setResults([...all])` Updates können bei großen Checkmengen unnötige Re-Renders auslösen. | `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts:522-529`, `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts:581` |
| F-006 | P3 | Tests | Bestehende Tests decken nur kleine Selektions-/Filter-Hooks ab; kritische Flows (Fix Runner, Upload, Preferences) fehlen. | `__tests__/diagnosticIssueFiltering.test.tsx:24-44`, `__tests__/diagnosticSelection.test.tsx:17-57` |

---

## F-001 — Patch-Dedupe kann falsche Duplikate erzeugen

### Problem
`applyFixList` dedupliziert Patches via `patchFingerprint`. Der Fingerprint berücksichtigt aber nur Anzahl Operationen und betroffene Pfade, nicht den tatsächlichen Content der Änderungen.

### Impact
Unterschiedliche Fixes mit gleicher Struktur (z. B. beide ändern `package.json`, aber mit unterschiedlichem Inhalt) können als Duplikat gelten. Dadurch wird mindestens ein Fix stillschweigend nicht angewendet.

### Repro-Szenario
1. Zwei Issues mit `fix.patch.upsert` auf denselben Pfad(en), gleicher Op-Anzahl.
2. Inhalte unterscheiden sich.
3. Batch-Apply (AutoFix/SmartFix/Apply Selected) ausführen.
4. Einer der Fixes wird als Dup übersprungen, obwohl inhaltlich notwendig.

### Empfehlung
- Fingerprint um content-sensitive Merkmale erweitern (z. B. stabilen Hash über `upsert.content` + `jsonMerge.patch`).
- Alternative: auf Dedupe verzichten und stattdessen Konflikterkennung (same path + incompatible payload) explizit behandeln.
- UI-seitig „skipped dup“ nur bei nachweislich identischem Patch setzen.

## F-002 — Preference-Load/Save-Race überschreibt persistierte Werte

### Problem
`useDiagnosticPreferences` lädt Werte asynchron aus `AsyncStorage`, startet aber parallel den Save-Effekt auf Basis der initialen Defaults.

### Impact
Bei langsamer Storage-Antwort oder kaltem Start kann der Save-Timer Defaults zurückschreiben, bevor der Load abgeschlossen ist. Nutzerpräferenzen wirken „vergessen“ oder flappen zwischen alten/neuen Werten.

### Repro-Szenario
1. App mit bereits gespeicherten Präferenzen starten.
2. Simulierte Storage-Latenz (Device/Emulator langsam).
3. Direkt nach Mount läuft Save-Effekt -> Defaults werden persistiert.
4. Gespeicherte Werte gehen verloren.

### Empfehlung
- Save-Effekt erst aktivieren, wenn Initial-Load abgeschlossen ist (`hydrated`-Flag).
- Optional: beim ersten Render Save komplett unterdrücken und erst bei User-Interaktion persistieren.

## F-003 — Inkonsistente Unmount-Safety in Async-Diagnostics

### Problem
`mountedRef` wird genutzt, aber `setProgressStage` wird in `runLocalChecks` und `runPipelineChecks` auch ohne Guard aufgerufen.

### Impact
Bei schnellem Screen-Wechsel während laufender Checks entstehen unnötige State-Updates auf unmounted Komponenten (Dev-Warnings, potenzielle Nebenwirkungen in zukünftigen React-Versionen).

### Empfehlung
- Vor jedem `setProgressStage` denselben Guard anwenden wie bei `setResults`.
- Optional: Abort-/Cancellation-Konzept ergänzen (z. B. run token / generation counter), um stale runs sauber zu beenden.

## F-004 — Filter-API und UI sind inkonsistent (`info`)

### Problem
Filter-Typ erlaubt `info`, aber die UI rendert nur `all/critical/warning`. Gleichzeitig liefert der Hook für `info` immer `[]`, da vorher alle `pass`-Einträge entfernt werden.

### Impact
Irreführender API-Vertrag, unnötige Komplexität und potenzielle Fehlannahmen in späteren Erweiterungen/Testfällen.

### Empfehlung
- Entweder `info` konsequent entfernen (Typ + Props) oder UI + Hook so erweitern, dass `info` tatsächlich erreichbar ist.
- Den gewünschten Produktentscheid dokumentieren (Issues-Tab soll nur non-pass zeigen oder auch info/pass?).

## F-005 — Häufige Progressive Updates können Render-Kosten erhöhen

### Problem
Während Diagnostics werden Ergebnisse bei jedem Stage-Chunk per `setResults([...all])` propagiert.

### Impact
Bei vielen Checks/Profilen kann das zu vielen Re-Renders in `FlatList`/Subtrees führen. Auf schwächeren Geräten wird das spürbar.

### Empfehlung
- Progressive Updates throttlen/batchen (z. B. alle X ms oder pro Stage statt pro Chunk).
- Zusätzlich `renderItem`/Callbacks stabilisieren (memoisierte Item-Komponente), falls noch nicht ausreichend.

## F-006 — Testabdeckung für High-Risk-Flows fehlt

### Problem
Es existieren nur Hook-Unit-Tests für Selection/Filtering. Kritische Pfade fehlen.

### Impact
Regressionen in Fix-Automation, Upload/Cooldown und Preference-Restore werden spät entdeckt.

### Empfehlung
- Priorisierte Tests für FixRunner (Batch/Sync/Rerun/Failure), Preferences Hydration und Upload-Cooldown ergänzen.

---

## Quick Wins (max. 10)

1. `patchFingerprint` content-sensitiv machen.
2. `useDiagnosticPreferences`: `hydrated`-Gate für Save-Effekt.
3. `setProgressStage` konsequent mit `mountedRef` absichern.
4. Filter-Contract bereinigen (`info` entfernen oder vollständig unterstützen).
5. Progressive Ergebnis-Updates throttlen.
6. In Fix-Modal klarer markieren, wenn dedupe-bedingt etwas übersprungen wurde (mit Grund).
7. Alert-Texte in Fix-Flows konsolidieren (weniger Duplikation, konsistenter Fehlerwortlaut).
8. Typisierung in Screen-Props reduzieren von `any` auf konkrete Typen (`recommendedMode`, `selectedModes`, `navigation`).

## Optional Improvements

- Cancellation-Token pro Diagnostic-Run einführen (robuster gegen stale async updates als nur `runningRef`).
- `syncPatchToGitHub` optional transaktionaler gestalten (z. B. dry-run validation + clearer partial-failure reporting).
- Für große Listen optional vorbereitende Memoisierung auf Card-Ebene (`React.memo(IssueCard)`) evaluieren.

## Test Suggestions (1–5)

1. **Batch Dedupe Correctness Test**: Zwei Patches mit gleichen Pfaden/op-count, aber unterschiedlichem Content -> beide müssen anwendbar bleiben.
2. **Preferences Hydration Race Test**: AsyncStorage-Load verzögert, sicherstellen, dass Defaults nicht persistierte Werte überschreiben.
3. **Unmount Safety Test**: Laufende `runDiagnostics` + unmount -> keine unguarded state updates / warnings.
4. **Fix Runner Failure Path Test**: Fehler in `syncPatchToGitHub` markiert korrekten Step als failed und beendet Flow deterministisch.
5. **Upload Cooldown Behavior Test**: Cooldown persistence (`UPLOAD_COOLDOWN_KEY`) über Remount hinweg korrekt, inklusive Ablauf-Reset.
