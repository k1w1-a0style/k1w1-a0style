# TerminalScreen Critical Review

**Datum:** 2026-02-10

## Kurzfazit

- Der Terminal-Flow ist funktional klar getrennt (Screen + Hook + Context), aber es fehlen wichtige Hardening-Maßnahmen für sensible Log-Inhalte.
- Kritisch: Logs werden ungefiltert in Auto-Fix-Payloads, TXT/ZIP-Exporte und Clipboard übernommen; damit ist Secret-Leakage wahrscheinlich.
- Es gibt keinen Schutz gegen parallele Export-/Share-Aktionen (Double-Tap-Race), was zu inkonsistenten UX-/Datei-Zuständen führen kann.
- Lifecycle-Sicherheit ist unvollständig: `requestAnimationFrame`-basierte Flushes im `TerminalContext` werden nicht explizit bei Unmount gecancelt.
- Bei großen/hochfrequenten Log-Mengen drohen unnötige Re-Renders/Scroll-Jank (Auto-Scroll via `onContentSizeChange` bei jedem Wachstum).
- Typing/Contracts sind insgesamt solide, aber Nullability von `expo-file-system` Basisverzeichnissen wird nicht defensiv behandelt.
- Für den TerminalScreen-Kontext sind keine dedizierten Tests vorhanden (inkl. kritischer Edgecases wie Secret-Masking, Race, Export-Fehlerpfade).

## Findings

| ID | Severity | Bereich | Kurzbeschreibung | Datei:Zeile |
|---|---|---|---|---|
| TS-001 | P1 | Security/Privacy | Unmaskierte Logs werden direkt an Auto-Fix übergeben (inkl. potentieller Tokens/Keys). | `screens/TerminalScreen/hooks/useTerminalScreen.ts:183-197` |
| TS-002 | P1 | Security/Privacy | Export/Copy-Funktionen übernehmen Logtext 1:1 ohne Redaction; hohes Leak-Risiko bei Sharing/Clipboard. | `screens/TerminalScreen/hooks/useTerminalScreen.ts:57-63,72-79,81-107,109-167`; `screens/TerminalScreen/components/LogRow.tsx:18-23` |
| TS-003 | P2 | Correctness/Lifecycle | Kein explizites Canceln geplanter Batch-Flushes; Cleanup loggt zusätzlich beim Unmount. | `contexts/TerminalContext.tsx:81-94,121-124,174-200` |
| TS-004 | P2 | Correctness/Race | Share/Export-Actions haben keinen In-Flight-Guard; mehrfaches Triggern kann parallel laufen. | `screens/TerminalScreen/hooks/useTerminalScreen.ts:81-107,109-167` |
| TS-005 | P2 | Typing/Robustness | `FileSystem.documentDirectory/cacheDirectory` werden ohne Null-Guard interpoliert. | `screens/TerminalScreen/hooks/useTerminalScreen.ts:88,116,151` |
| TS-006 | P2 | Performance/UX | Auto-Scroll wird auf jedem `onContentSizeChange` ausgelöst; bei hohem Log-Durchsatz drohen Scroll-Stürme/Jank. | `screens/TerminalScreen/hooks/useTerminalScreen.ts:214-219`; `screens/TerminalScreen/index.tsx:69-77` |
| TS-007 | P3 | Maintainability | `searchAnim` ist effektiv statisch (Wert 1), es gibt keine Animationsteuerung. | `screens/TerminalScreen/hooks/useTerminalScreen.ts:32-33`; `screens/TerminalScreen/index.tsx:61-67` |
| TS-008 | P2 | Tests | Keine dedizierten Tests für TerminalScreen/TerminalContext-Flow (Filter, Export, Masking, Race, Cleanup). | `__tests__/` (keine Terminal-spezifischen Specs auffindbar) |

---

## Detailsektionen

### TS-001 — Unmaskierte Logs in Auto-Fix Payload (P1)

**Problem**  
Der Auto-Fix Payload enthält direkt den (letzten) Logtext via `toText(filteredLogs).slice(-15000)` ohne Secret-Redaction.

**Impact**  
API-Keys, Tokens, Authorization-Header, Repo-URLs mit Credentials oder personenbezogene Daten können an nachgelagerte KI-/Backend-Strecken gelangen.

**Repro-Szenario**  
1. App loggt versehentlich `EXPO_TOKEN=...` oder `Authorization: Bearer ...`.  
2. User öffnet TerminalScreen und klickt Auto-Fix.  
3. Secret wandert ungefiltert in `triggerAutoFix(payload)`.

**Empfehlung**  
Vor dem Payload-Bau eine dedizierte Sanitization-Phase einführen (z. B. regex-basierte Redaction für typische Secret-Muster + Länge/Entropy-Heuristik + opt-in für unredacted Versand). Zusätzlich UI-Hinweis: „Sensible Daten werden maskiert“. Zielstelle: `sendLogsToAiAutoFix` im `useTerminalScreen`.

### TS-002 — Unmaskierte Copy/Export-Flows (P1)

**Problem**  
`toText` serialisiert Logs unverändert; dieselbe Funktion speist Clipboard, TXT-Export, ZIP-Export und Long-Press-Copy einer Einzelzeile.

**Impact**  
Erhöhtes Datenabfluss-Risiko über System-Clipboard, geteilte Dateien oder Messenger/Cloud-Targets.

**Repro-Szenario**  
1. Secret im Log.  
2. „Copy“ oder „Share/ZIP“ im Terminal nutzen.  
3. Secret liegt im Clipboard/Export unmaskiert vor.

**Empfehlung**  
Zwei Textpfade trennen: `toTextRaw` (intern, streng limitiert) und `toTextSanitized` (default für Copy/Share/ZIP/UI). Bei Bedarf „Include sensitive data“ explizit per Confirm-Dialog.

### TS-003 — Lifecycle/Unmount-Sicherheit beim Log-Batching (P2)

**Problem**  
Batch-Flush nutzt `requestAnimationFrame`, aber es gibt keinen gespeicherten Frame-Handle + kein `cancelAnimationFrame` im Cleanup. Zusätzlich erzeugt `removeConsoleOverride` beim Cleanup selbst noch ein Log (`deaktiviert`).

**Impact**  
Im Unmount-/Toggle-Grenzfall können unnötige State-Transitions oder schwer nachvollziehbare Spät-Flushes auftreten.

**Repro-Szenario**  
Schnell zwischen Screens wechseln, während viele Logs ankommen und Console Override toggeln.

**Empfehlung**  
Frame-ID in `useRef` halten und im Cleanup canceln; beim Unmount optional Logging im `removeConsoleOverride` unterdrücken (z. B. Flag `isUnmounting`).

### TS-004 — Kein Singleflight für Share/Export (P2)

**Problem**  
`shareVisibleLogsTxt` und `exportDebugZip` besitzen keinen Guard (`isExporting`/`isSharing`). Mehrfachklicks können parallele Schreib-/Share-Sequenzen auslösen.

**Impact**  
Doppelte Dateien, widersprüchliche Alerts, potenziell instabile Share-Dialog-Interaktion.

**Repro-Szenario**  
Schnelles mehrfaches Tippen auf Share/Archive-Button.

**Empfehlung**  
Per Hook-State (`inFlightAction`) singleflight einführen, Buttons während laufender Aktion deaktivieren, Ergebnis/Fehlerzustände eindeutig zurücksetzen.

### TS-005 — Nullability von FileSystem-Basispfaden nicht abgesichert (P2)

**Problem**  
`FileSystem.documentDirectory` und `FileSystem.cacheDirectory` werden direkt in Template-Strings genutzt.

**Impact**  
Auf Plattform-/Runtime-Kombinationen mit `null`-Werten entstehen invalide Pfade und Folgefehler.

**Repro-Szenario**  
Runtime liefert unerwartet `null` (z. B. Plattformvarianz/Testumgebung) → `nullterminal_logs_...`.

**Empfehlung**  
Vor Nutzung Null-Guard + frühes, benutzerfreundliches Failure-Alert (inkl. technischem Grund) ergänzen.

### TS-006 — Auto-Scroll bei jeder Content-Änderung (P2)

**Problem**  
`onContentSizeChange` triggert `scrollToOffset({ offset: 0 })` bei aktivem Auto-Scroll jedes Mal, wenn sich die Listenhöhe ändert.

**Impact**  
Bei hohem Log-Durchsatz steigt Scroll-Frequenz; das kann Jank/Unruhe verursachen und User-Interaktion stören.

**Repro-Szenario**  
Console Override aktivieren, viele Logs schnell erzeugen (Build/Verbose Output).

**Empfehlung**  
Throttling/debounced Scroll, nur bei „neuer Top-Entry“ statt jeder Größenänderung, optional `InteractionManager`/raf-coalescing nutzen.

### TS-007 — Toter Animationspfad (`searchAnim`) (P3)

**Problem**  
`searchAnim` wird initial auf 1 gesetzt und nie verändert; der `Animated.View` bringt aktuell keinen funktionalen Mehrwert.

**Impact**  
Kleine Wartbarkeitslast/Irreführung („fancy search reveal“ suggeriert bestehende Animationslogik).

**Empfehlung**  
Entweder echte Reveal-Animation implementieren oder den Dead Path entfernen, um Intent klar zu halten.

### TS-008 — Fehlende Terminal-Flow Tests (P2)

**Problem**  
Kein dedizierter Test-Block für TerminalScreen/TerminalContext-Flows erkennbar.

**Impact**  
Regressionsrisiko bei sicherheitskritischen und race-anfälligen Pfaden bleibt hoch.

**Empfehlung**  
Gezielte Tests für Redaction, Export-Fehlerpfade, Singleflight, Auto-Scroll-Verhalten, Cleanup/Unmount ergänzen.

---

## Quick Wins (max. 10)

1. Redaction Utility zentral einführen und in **allen** Outbound-Logpfaden verwenden (Auto-Fix, TXT, ZIP, Clipboard).
2. `isExporting`/`isSharing` State + Button-Disable implementieren.
3. Null-Guards für `documentDirectory`/`cacheDirectory` ergänzen.
4. Export-Dateinamen um Session-ID ergänzen (bessere Korrelation/Entkoppelung bei Race).
5. Cleanup-Flag im TerminalContext einbauen, um Unmount-Logs zu vermeiden.
6. `requestAnimationFrame` handle speichern + cleanup via `cancelAnimationFrame`.
7. `onContentSizeChange` throttlen.
8. Optional `React.memo(LogRow)` + stabilen `renderItem` Callback prüfen.
9. Search-Animation entweder realisieren oder entfernen.
10. Security-Hinweistext im UI vor Share/Auto-Fix ergänzen.

## Optional Improvements

- Log-Level-basierte Exportprofile (z. B. nur `error|warn` standardmäßig).
- Konfigurierbares Retention-Limit (500 fest ist simpel, aber unflexibel).
- Strukturierte Log-Events (z. B. `source`, `module`, `tag`) statt nur Freitext.
- Telemetrie für Export-Fehlerraten (lokal anonymisiert), um UX-Schwachstellen messbar zu machen.

## Test Suggestions (konkrete, wertvolle Tests)

1. **Secret Redaction Test:** Log enthält Token-ähnliche Strings; Auto-Fix/Copy/Export enthalten nur maskierte Werte.
2. **Singleflight Export Test:** Doppeltes Triggern von ZIP/TXT erzeugt genau einen laufenden Job und konsistente UI-Rückmeldung.
3. **Unmount Cleanup Test:** Während pending Batch-Flush unmounten; keine späten unerwarteten State-Updates/Side-Effects.
4. **Auto-Scroll Stress Test:** Viele Logs in kurzer Zeit; Scroll-Verhalten bleibt stabil und blockiert User-Interaktion nicht.
5. **Directory Nullability Test:** Simulierte `null`-Directories führen zu sauberem Fehlerpfad statt invalider Pfadbildung.
