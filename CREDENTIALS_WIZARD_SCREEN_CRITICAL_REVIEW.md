# CredentialsWizardScreen – Critical Review

**Datum:** 2026-02-10

## Kurzfazit

- Der Screen ist funktional klar aufgebaut und trennt View/State-Logik bereits sinnvoll über `useCredentialsWizardScreen`.
- Positiv: Der Admin-Key wird mit `SecureStore` persistiert und als `secureTextEntry` im UI maskiert.
- Kritisch: Debug/Error-Daten werden roh gespeichert, angezeigt und in die Clipboard kopiert – das kann sensitive Inhalte exfiltrieren.
- Kritisch: `generate()` hat keinen Re-Entrancy-Guard; schnelle Doppelklicks können parallele Requests erzeugen.
- Stabilität: Async-Operationen (Status/Generate) haben keine generelle Unmount-Schutzlogik und können nach Navigation State setzen.
- Validierung ist sehr minimal (`Boolean(...)`) und schützt nicht gegen fehlerhafte URL/Repo-Formate oder versehentliche Leerzeichen.
- Typing/API-Verträge sind teilweise weich (`any`) und reduzieren Compile-Time-Sicherheit.
- Es gibt keine gezielte Test-Coverage für diesen Screen (Secret-Leak, Race, Restore/Resume).

## Findings

| ID | Severity | Bereich | Kurzbeschreibung | Datei:Zeile |
|---|---|---|---|---|
| F-001 | P1 | Security/Hardening | Response-Body wird vollständig in Debug-State gehalten und kann im UI/Clipboard landen. | `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts:72-74,161-168,310-312`; `screens/CredentialsWizardScreen/components/DebugSection.tsx:61-65` |
| F-002 | P1 | Security/Hardening | Fehlertexte werden ungefiltert angezeigt/kopiert; potenzielles Secret-Leak in Fehlermeldungen. | `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts:206-207,291-293,305-307`; `screens/CredentialsWizardScreen/components/ErrorSection.tsx:54-59` |
| F-003 | P1 | Correctness/Race | `generate()` hat keinen Re-Entrancy-Guard, parallele Generate-Requests sind möglich. | `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts:259-296`; `screens/CredentialsWizardScreen/components/ModeSection.tsx:40-44` |
| F-004 | P2 | Correctness/Unmount-Safety | Async Actions (refresh/generate) setzen State ohne `mounted`-Guard nach Unmount. | `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts:183-211,230-256,259-296` |
| F-005 | P2 | Validation/API Contracts | `canRun` prüft nur auf Non-Empty; URL/Repo/Input-Format nicht validiert. | `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts:155-157,192-195,271-276` |
| F-006 | P3 | Typing/Maintainability | Mehrere `any`-Verwendungen schwächen Contracts zwischen UI/Backend. | `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts:59-60,127,284-285`; `screens/CredentialsWizardScreen/components/KeystoreStatusSection.tsx:33` |
| F-007 | P2 | Tests | Keine spezifischen Tests für CredentialsWizardScreen (Leak/Race/Restore). | `screens/CredentialsWizardScreen/**` (keine Testdateien) |

---

## F-001 – Unredacted Debug Payload kann Secrets leaken

### Problem
`invokeEdgeJson()` liest immer den kompletten HTTP-Body als Text und speichert ihn in `lastDebug`. Dieser wird serialisiert, im Debug-Panel angezeigt und per „Copy“ in die Zwischenablage kopiert.

### Impact
- Falls Edge-Fehlerantworten sensitive Felder enthalten (Stacktraces, env-Hinweise, intern zurückgespiegelte Daten), gelangen diese direkt in UI/Clipboard.
- Erhöhtes Risiko bei Screen-Recording, Crash-Reports (falls UI dump), Shoulder Surfing.

### Repro-Szenario
1. Edge Function antwortet auf Fehler mit JSON inkl. sensitiver Details.
2. User öffnet „Request Debug“ und drückt Copy.
3. Sensitive Daten liegen unverändert in der Clipboard.

### Empfehlung
- Debug-Body vor Speicherung sanitizen (redaction pattern + truncation).
- In produktiven Builds Debug-Body standardmäßig unterdrücken oder nur whitelisted Felder anzeigen.
- Copy-Funktion nur für sanitized Payload erlauben.

---

## F-002 – Ungefilterte Error-Ausgabe/Kopie

### Problem
Errors aus `catch` werden als `e?.message ?? String(e)` direkt in `lastError` geschrieben und im Error-Panel angezeigt; zusätzlich per Copy in Clipboard exportierbar.

### Impact
- Fehlermeldungen aus Downstream-Layern können implizit sensitive Daten enthalten (URLs mit Query, Header-Metadaten, interne Tokens in Exception-Texten).
- Führt zu derselben Exfiltration-Klasse wie F-001, aber über Error-Path.

### Empfehlung
- Einheitliche `sanitizeErrorForUi()`/`sanitizeForClipboard()` einführen.
- Längere Rohfehler intern loggen (nur dev), UI-seitig gekürzt/redacted darstellen.
- Clipboard-Copy mit Warnhinweis oder redacted-only erlauben.

---

## F-003 – Fehlender Guard gegen Double-Submit bei Generate

### Problem
`refreshStatus()` und `refreshAll()` nutzen Refs als Guard, `generate()` nicht. Obwohl Buttons bei `busy` disabled werden, ist ein schneller Doppeltap vor Re-Render möglich.

### Impact
- Doppeltes Triggern von `android-keystore-generate` möglich.
- Unklare Idempotenz serverseitig: doppelte Jobs, Race auf derselben Resource, inkonsistente UI-Rückmeldungen.

### Repro-Szenario
- Zwei schnelle Taps auf „Generate“ (insb. auf langsameren Devices) vor UI-Disable.

### Empfehlung
- `runningGenerateRef` (oder ein mode-spezifisches Inflight-Set) ergänzen.
- Optional serverseitig idempotency key nutzen (repo+mode+request window).

---

## F-004 – Unmount/Cancellation nur teilweise abgesichert

### Problem
Initiale `useEffect`-Loader sind via `mounted` abgesichert; spätere async Actions (`refreshStatusCore`, `refreshAll`, `generate`) setzen State ohne Unmount-Check.

### Impact
- State-Updates nach Unmount können zu Warnungen, unnötigen Renders und schwer reproduzierbaren UI-Artefakten führen.

### Empfehlung
- Zentrale `isMountedRef`-Guard-Strategie für alle async Pfade.
- Optional AbortController für Fetches, falls Navigation während Requests stattfindet.

---

## F-005 – Zu schwache Input-Validierung

### Problem
`canRun` ist reine Presence-Validation (`Boolean(supabaseUrl && adminKey && repoFullName)`).

### Impact
- Ungültige Formate (z. B. `repo`, URL ohne Schema, versehentliche Spaces) gehen bis zum Netzwerk-Call durch und produzieren nur Laufzeitfehler.
- Schlechtere UX + schwerere Diagnose.

### Empfehlung
- Vor Requests explizit validieren:
  - `repoFullName` in Form `owner/repo`
  - `supabaseUrl` als valide HTTPS-URL
  - `adminKey` trim + min-length/pattern (falls definierbar)
- Feldspezifische Fehlermeldungen statt generischem „Fehlt was“.

---

## F-006 – Weiche Typen (`any`) in kritischen Pfaden

### Problem
Mehrere `any`-Verwendungen in Fetch-/Response- und UI-Meta-Pfaden.

### Impact
- Contract-Brüche zwischen Edge Response und UI fallen später auf (runtime statt compile-time).
- Erhöht Refactor-Risiko.

### Empfehlung
- Discriminated unions für API-Erfolg/Fehlerantworten.
- `metaForStatus` Icon-Typ auf `keyof typeof Ionicons.glyphMap` präzisieren.
- `invokeEdgeJson<T>()` generisch typisieren, statt `any`.

---

## F-007 – Test-Lücke für kritische Sicherheits-/Race-Pfade

### Problem
Es sind keine Screen-nahen Tests für CredentialsWizard vorhanden.

### Impact
- Regressionen in Secret-Handling, Double-Submit-Prevention oder Restore-Pfaden werden wahrscheinlich erst manuell entdeckt.

### Empfehlung
- Fokus-Tests hinzufügen (siehe „Test Suggestions“ unten).

---

## Quick Wins (max. 10)

1. Debug/Error vor Anzeige und Clipboard konsequent redaction + truncation unterziehen.
2. `generate()` mit eigenem Inflight-Guard versehen.
3. Gemeinsame `safeSetStateIfMounted`-Helferfunktion für async Actions einsetzen.
4. Feldvalidierung für Repo/URL ergänzen und UI-nahe Fehlertexte anzeigen.
5. `busy` als strukturierter Typ (z. B. union/object) statt freiem String modellieren.
6. `invokeEdgeJson` generisch typisieren (`<TSuccess, TError>`).
7. Copy-Aktionen an „dev mode“ koppeln oder mit Warnung versehen.
8. Optionales „Clear debug/error“ anbieten, um sensible Residualdaten zu reduzieren.

## Optional Improvements

- „Wizard“ stärker als echte Step-Maschine modellieren (z. B. `Enter Key -> Verify Status -> Generate -> Verify`), inkl. Resume-State.
- Audit-Trail im UI nur mit nicht-sensitiven Metadaten (Timestamps/Statuscodes) statt Payload-Body.
- Centralized security utilities für alle Screens (`sanitizeForUi`, `sanitizeForClipboard`, `maskSecret`).

## Test Suggestions

1. **Security:** Test, dass Debug/Error-Strings vor Rendering/Clipboard redacted sind (z. B. token-like patterns).
2. **Race:** Doppelklick auf Generate → nur **ein** Netzwerk-Call.
3. **Unmount:** Request starten, Screen unmounten, danach keine State-Updates/Warnings.
4. **Validation:** Ungültige Repo-/URL-Werte blockieren Request und zeigen feldspezifische Fehlermeldung.
5. **Restore:** Persistierter Admin-Key wird geladen, aber nie unmasked im UI angezeigt.
