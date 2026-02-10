# ChatScreen Critical Review (Expo/React-Native)

**Datum:** 2026-02-10

## Kurzfazit
- Die Chat-Implementierung ist funktional und enthält bereits sinnvolle Schutzmechanismen (z. B. `isMounted`-Guards, Key-Rotation bei 429, FlatList-Virtualisierung).
- Es gibt jedoch mehrere **kritische Robustheits- und Datenschutzlücken** im direkten Chat-Flow.
- Besonders relevant: **persistente Speicherung des kompletten Chatverlaufs in Klartext**, fehlende Request-Cancellation, und ein potenzieller AutoFix-Drop bei mehreren schnellen Requests.
- Die Parsing-/Merge-Pipeline ist grundsätzlich robust, enthält aber Edgecases, die legitime Antworten/Dateien verwerfen können.
- Der zentrale Chat-Flow ist stark konzentriert in `useChatAIFlow` (großer Scope, viele Verantwortlichkeiten), was Testbarkeit und Wartbarkeit erschwert.
- Testabdeckung ist bei Parsing/Orchestrator-Utilities vorhanden, aber es fehlen wichtige Szenario-Tests auf Hook-/Flow-Ebene (Queueing, Unmount, Retry, Restore).

## Findings

| ID | Severity | Bereich | Kurzbeschreibung | Datei:Zeile |
|---|---|---|---|---|
| F-01 | P1 | Security/Privacy | Chat-History (inkl. User-Prompts/Assistant-Outputs) wird vollständig in AsyncStorage persistiert (Klartext), ohne Redaction/TTL/Opt-out. | `contexts/ProjectContext.tsx:225-230`, `contexts/projectStorage.ts:107-111` |
| F-02 | P1 | Correctness/Resilience | Netzwerkrequests laufen ohne `AbortController`; bei Screen-Unmount werden nur State-Updates abgesichert, nicht der Request selbst. | `hooks/useChatAIFlow.ts:91-120`, `lib/orchestrator.ts:197-206`, `230-240`, `298-312` |
| F-03 | P1 | Correctness (Queueing) | AutoFix-Queue ist ein Single-Slot (`queuedAutoFixRef`), spätere Requests überschreiben frühere während In-Flight-Phase. | `hooks/useChatAIFlow.ts:96`, `174-203`, `511-514` |
| F-04 | P2 | Correctness/UX | User-Input wird vor Abschluss von `handleSendWithMeta` geleert; bei Fehlern geht Eingabetext verloren (kein Restore). | `screens/ChatScreen/hooks/useChatScreen.ts:287-295`, `hooks/useChatAIFlow.ts:496-506` |
| F-05 | P2 | Correctness (Parsing) | Normalizer extrahiert primär JSON-Arrays aus Text; Objekt-Antworten mit `files` + umgebendem Text/Fences können unnötig fehlschlagen. | `lib/normalizer.ts:21-31`, `123-141`, `151-152` |
| F-06 | P2 | Correctness (Merge policy) | Neue Code-Dateien werden nur gegen **incoming** Referenzen geprüft; bestehende Projektdateien werden nicht in Entscheidungslogik einbezogen. | `lib/fileWriter.ts:193-197`, `121-143` |
| F-07 | P2 | Typing/API Contracts | Mehrere zentrale Flow-Pfade nutzen `any` (`config`, Errors, Responses), wodurch API-Vertragsverletzungen spät auffallen. | `hooks/useChatAIFlow.ts:29-31`, `39-46`, `496`, `lib/orchestrator.ts:180`, `lib/normalizer.ts:107` |
| F-08 | P3 | Maintainability/Testability | `useChatAIFlow` bündelt Planner/Builder/Validator/Streaming/Queue/Apply in einem großen Hook; hohe Komplexität und schwierige isolierte Tests. | `hooks/useChatAIFlow.ts:68-696` |

---

## F-01 – Persistente Klartext-Chat-History
### Problem
Chat-Messages werden direkt an `chatHistory` angehängt und das Gesamtprojekt regelmäßig in AsyncStorage gespeichert. Es gibt keine Redaction (z. B. für Tokens/PII), keine Verschlüsselung auf App-Ebene, keine Aufbewahrungssteuerung.

### Impact
- Datenschutzrisiko bei Geräten mit Backup/Forensik-Zugriff.
- Potenzielle Compliance-Probleme (je nach Nutzungsumfeld).

### Repro-Szenario
1. Sensitiven Prompt im Chat senden.
2. App schließen/neu öffnen.
3. Prompt bleibt im gespeicherten Projekt erhalten.

### Empfehlung
- Chat-History standardmäßig als „sensitive data“ behandeln.
- Optionalen Privacy-Mode ergänzen: keine Persistenz oder nur letzte N Nachrichten.
- Vor Persistierung Redaction-Pipeline einführen (Secrets/Keys/Emails/URLs etc.).
- Bei Bedarf verschlüsselte Speicherung (Secure-Storage-basierter Schlüssel + verschlüsselte Payload).

## F-02 – Keine echte Cancellation für laufende AI-Requests
### Problem
Unmount-Guards verhindern State-Updates, aber `fetch`-Calls laufen weiter. Das bindet unnötig Ressourcen und verhindert sauberes „Cancel on leave“.

### Impact
- Unnötige Netzwerk-/Akkulast.
- Mögliche Race-Effekte bei schnellem Navigieren und erneutem Einstieg.

### Empfehlung
- `runOrchestrator` und Provider-Calls auf `AbortSignal` erweitern.
- Im Hook einen `AbortController` pro Request verwalten und bei Unmount/Neuversand abbrechen.
- UI-seitig explizite Cancel-Option für lange Antworten erwägen.

## F-03 – AutoFix-Requests können verloren gehen
### Problem
Die Queue ist nur ein `string | null`. Kommen mehrere AutoFix-Events während `inFlightRef.current === true`, bleibt nur der letzte erhalten.

### Impact
- Nicht deterministisches Verhalten bei mehreren Triggern.
- Potenzieller Verlust von Nutzer-/Systemintention.

### Repro-Szenario
1. Zwei AutoFix-Requests schnell hintereinander auslösen.
2. Während erster läuft, setzt zweiter `queuedAutoFixRef` neu.
3. Frühere Queue-Inhalte werden überschrieben.

### Empfehlung
- Echte FIFO-Queue (`string[]`/Objekt-Queue) statt Single-Slot.
- Idempotenz über Request-ID und Dedupe-Strategie.
- Tests für Sequenzierung und „burst events“ ergänzen.

## F-04 – Input-Verlust bei Fehlern
### Problem
`handleSend` leert Input und Anhang vor der eigentlichen AI-Verarbeitung. Schlägt der Flow fehl, bleibt nur Error-Message, aber kein Draft-Restore.

### Impact
- Schlechter UX bei temporären Netzwerk-/Providerfehlern.
- Nutzer muss lange Eingaben neu tippen.

### Empfehlung
- Optimistic-Clear nur bei bestätigtem Start + lokales Draft-Backup.
- Bei Fehler: Draft automatisch wiederherstellen (optional per Snackbar „Wiederherstellen“).
- Alternativ: erst nach erfolgreicher Entgegennahme durch Backend löschen.

## F-05 – Parsing-Edgecases bei Objekt-Wrappern
### Problem
Der Normalizer fokussiert beim Text-Unwrap auf Array-Extraktion. Wenn Modelle `{ files: [...] }` mit zusätzlichem Text/Fences liefern, kann das trotz gültigem Kerninhalt scheitern.

### Impact
- Vermeidbare „Normalizer konnte nicht verarbeiten“-Fehler.
- Unnötige Wiederholungsanfragen.

### Empfehlung
- Neben `extractJsonArrayFallback` auch objektbasierten balanced-`{}`-Fallback ergänzen.
- Bei Parse-Fail gezielter zweiter Parse-Versuch auf Codefence-Inhalt.
- Tests für „text + object wrapper + files[]“ ergänzen.

## F-06 – Referenzprüfung neuer Dateien zu eng
### Problem
Neue Code-Dateien werden nur akzeptiert, wenn sie im incoming Change-Set referenziert werden. Referenzen aus bereits bestehenden Dateien werden in der Entscheidung aktuell nicht verwendet.

### Impact
- Legitime Dateien können als „nicht eingebunden“ verworfen werden.
- Erhöht Friktion für inkrementelle Änderungen.

### Empfehlung
- Bei `!already` Referenzprüfung gegen incoming **und** existing kombinieren.
- Policy ggf. lockern für bekannte Entry-/Screen-Pfade.
- Explizite Benutzer-Intention („erstelle Datei X ohne Import“) als Override berücksichtigen.

## F-07 – Schwache Typsicherheit in Kernpfaden
### Problem
Zentrale Objekte/Responses sind stark `any`-basiert; Fehler werden dadurch runtime-lastig erkannt.

### Impact
- Höheres Risiko stiller Contract-Drifts zwischen UI ↔ Orchestrator ↔ Normalizer.
- Erschwerte Refactors.

### Empfehlung
- `OrchestratorResult` um diskriminierte Union erweitern (`ok: true/false`).
- `PendingChange.aiResponse/agentResponse` typisieren.
- `catch (e: unknown)` + standardisierte Error-Normalisierung nutzen.

## F-08 – Hohe Komplexität im Chat-Flow-Hook
### Problem
Ein Hook steuert Planner, Builder, Validator, Streaming, Queue, Apply/Reject, Error-Handling.

### Impact
- Hohe kognitive Last.
- Schwierig isolierbar zu testen, erhöhte Regressionswahrscheinlichkeit.

### Empfehlung
- In kleinere Hooks/Services splitten:
  - `usePlannerFlow`
  - `useBuilderFlow`
  - `useAutoFixQueue`
  - `useStreamingAssistantMessage`
- Zustandsmaschine (leichtgewichtig) für Flow-Transitions erwägen.

---

## Quick Wins (max. 10)
1. `AbortController` in `runOrchestrator` + Provider-Calls integrieren.
2. AutoFix von Single-Slot auf FIFO-Queue umstellen.
3. Draft-Restore bei Send-Fehler einbauen.
4. Parsing-Fallback um objektbasiertes JSON (`{...}`) erweitern.
5. Referenzprüfung neuer Dateien um `existing`-Dateien ergänzen.
6. `any` in `useChatAIFlow` für Config/Responses reduzieren.
7. Error-Nachrichten standardisieren (nutzerfreundlich + intern detailreich).
8. Optional: Chat-History-Retention (z. B. letzte 200 Messages).
9. Optional: Privacy-Toggle „Chat nicht persistent speichern“.
10. Hook-spezifische Unit-Tests (Queue, Retry, Unmount, PendingPlan-Branches).

## Optional Improvements
- Token-Budgeting im Builder-Flow explizit integrieren (z. B. harte Obergrenzen für History+Snapshot je Provider-Modus).
- UI: `MessageItem`-Codeblock-Rendering für sehr lange Antworten lazy/load-on-expand.
- Bessere Trennung zwischen Nutzer-Chat und technischen Systemmeldungen (separater Kanal/Filter).

## Test Suggestions (1–5)
1. **AutoFix FIFO-Test:** 3 AutoFix-Requests nacheinander, sicherstellen dass alle in Reihenfolge verarbeitet werden.
2. **Unmount-Cancel-Test:** Request starten, Hook unmounten, prüfen dass Fetch abgebrochen wurde und keine Folgeaktionen stattfinden.
3. **Draft-Recovery-Test:** Send mit simuliertem Orchestrator-Fehler, prüfen dass ursprünglicher Input wieder verfügbar ist.
4. **Normalizer Object-Wrapper-Test:** Antwortformat „Text + `{ files:[...] }` im Codeblock“ muss erfolgreich normalisieren.
5. **FileWriter Reference-Test:** neue Datei, die nur von bestehender Datei referenziert wird, darf nicht fälschlich verworfen werden.
