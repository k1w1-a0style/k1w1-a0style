# AppInfoScreen Critical Review

**Datum:** 2026-02-10

## Kurzfazit

- Die AppInfo-UI ist funktionsreich (Assets, API-Backup, Full-Backup, Projektinfos), enthält aber aktuell mindestens ein klares Privacy-Leak: API-Keys werden unmaskiert angezeigt.
- Es gibt einen relevanten Correctness-Widerspruch: Der API-Import kündigt „ersetzen“ an, implementiert aber ein Add/Merge-Verhalten.
- Import-Pfade sind nicht robust gegen strukturfehlerhafte Backup-Dateien (fehlende Type-Guards), was zu stillen Teilimporten oder fehlerhaften Werten führen kann.
- Typisierung im Slice ist schwach (`any` in Hook + mehreren Props), was API-Contract-Risiken erhöht.
- Für große Projekte kann Template-Ermittlung pro Render unnötig teuer sein (fehlende Memoisierung in `TemplateInfoSection`).
- Es gibt keine dedizierten Tests für AppInfoScreen/Backup/Redaction-Flows; sicherheitskritische UI-Pfade sind ungetestet.

## Findings

| ID | Severity | Bereich | Kurzbeschreibung | Datei:Zeile |
|---|---|---|---|---|
| F-001 | P1 | Security/Privacy | API-Keys werden vollständig im Klartext gerendert. | `screens/AppInfoScreen/components/ActiveApiKeysSection.tsx:54-56` |
| F-002 | P1 | Correctness/UX | Import-Dialog verspricht „ersetzen“, Implementierung macht faktisch Merge/Add ohne vorheriges Löschen. | `screens/AppInfoScreen/hooks/useAppInfoScreen.ts:360`, `381-389` |
| F-003 | P1 | Correctness/Validation | API-Backup-Import prüft Struktur nur oberflächlich; fehlerhafte Typen können fehlerhafte Teilimporte erzeugen. | `screens/AppInfoScreen/hooks/useAppInfoScreen.ts:89-91`, `382-386` |
| F-004 | P2 | Typing/API Contracts | Umfangreicher Einsatz von `any` in zentralen Datenpfaden reduziert Compile-time-Sicherheit. | `screens/AppInfoScreen/hooks/useAppInfoScreen.ts:31`, `180`, `517`, `550`; `screens/AppInfoScreen/components/*` Props mit `styles: any` |
| F-005 | P2 | Performance | Template-Ermittlung läuft pro Render ohne Memoisierung auf kompletter Dateiliste. | `screens/AppInfoScreen/components/TemplateInfoSection.tsx:16-19` |
| F-006 | P2 | Tests | Keine spezifischen Tests für AppInfo/Backup/Key-Redaction vorhanden. | Suche in `__tests__`, `lib/__tests__` (keine Treffer für AppInfo-spezifische Tests) |

## Details pro Finding

### F-001 — API-Keys im Klartext sichtbar

**Problem**
- In der UI werden API-Keys direkt als Klartext angezeigt (`{key}`) statt maskiert/redacted.

**Impact**
- Erhöhtes Shoulder-Surfing-Risiko.
- Screen-Recording/Screenshots/Remote-Support können produktive Secrets kompromittieren.

**Repro-Szenario**
1. Öffne AppInfoScreen mit konfigurierten Keys.
2. Scrolle zu „🔑 Aktive API-Keys“.
3. Vollständiger Key ist lesbar.

**Empfehlung**
- Standardmäßig maskieren (z. B. Prefix + `••••` + Suffix).
- Optional „anzeigen“-Toggle mit expliziter Nutzerinteraktion und Auto-Rehide.
- Falls Copy-Funktion ergänzt wird: nur bewusste Aktion + visuelles Feedback + kein ungewolltes Loggen.

---

### F-002 — Import-Semantik widerspricht UI-Text

**Problem**
- Der Dialogtext sagt: „ersetzt alle vorhandenen API-Keys“.
- Implementiert ist jedoch nur iteratives `addApiKey` plus Fehler-Ignore bei Duplikaten.

**Impact**
- Nutzer erwartet deterministischen Zustand nach Import, erhält aber einen merge-artigen Zustand.
- Debugging und Incident-Recovery werden schwerer, da Altlasten bestehen bleiben können.

**Repro-Szenario**
1. Vorhandene Keys in mehreren Providern konfigurieren.
2. Backup mit anderem Key-Set importieren.
3. Alte Keys bleiben ggf. erhalten; nur neue werden ergänzt.

**Empfehlung**
- Entweder UX-Text auf „hinzufügen/zusammenführen“ korrigieren **oder**
- vor Import je Provider explizit löschen und danach exakt importieren (idempotent).
- Ergebnisdialog soll „ersetzt“ vs „hinzugefügt/übersprungen“ transparent differenzieren.

---

### F-003 — Fehlende harte Import-Validierung

**Problem**
- `importAPIConfig` prüft nur `config` + `version`, nicht die exakte Struktur.
- Im Import-Loop wird `keys` ungeprüft iteriert; bei falschen Typen (z. B. String statt String-Array) drohen fehlerhafte Teilimporte.

**Impact**
- Inkonsistente Key-Stores, schwer nachvollziehbare Importresultate.
- Potenziell viele Fehlversuche/Alert-Lärm bei korrupten oder manipulierten Backups.

**Repro-Szenario**
- JSON mit `apiKeys.openai: "abc"` importieren; Iteration kann Zeichenketten-Elemente behandeln.

**Empfehlung**
- Vor Import strikte Schema-Validierung (Version + Provider-Menge + `string[]` je Provider).
- Bei Verstoß: harter Abbruch mit präziser Fehlermeldung, kein Teilimport.

---

### F-004 — Schwache Typisierung in Kernpfaden

**Problem**
- `config: any`, `typedProjectData as any`, `data.connections || ({} as any)`, `styles: any` etc.
- Dadurch fehlen verlässliche API-Contracts zwischen Hook und Sections.

**Impact**
- Edgecases werden erst zur Laufzeit sichtbar.
- Refactors sind riskanter; Tooling (Autocomplete/TS Checks) verliert Wirkung.

**Empfehlung**
- Für AppInfo-Slice klare Typen einführen: `AppInfoViewModel`, `BackupImportPayload`, `AssetsStatus`, typisierte Section-Props.
- `any` schrittweise durch spezifische Interfaces ersetzen.

---

### F-005 — Potenziell unnötige Rechenarbeit pro Render

**Problem**
- `resolveEffectiveTemplateId(templateId, files)` wird in `TemplateInfoSection` direkt pro Render ausgeführt.

**Impact**
- Bei großen `files`-Listen kann das UI unnötig Arbeit verrichten.

**Empfehlung**
- Ergebnis mit `useMemo` auf `[templateId, projectData?.files]` cachen oder upstream als vorberechneten Wert liefern.

---

### F-006 — Fehlende AppInfo-spezifische Tests

**Problem**
- Es gibt keinen dedizierten Test-Footprint für AppInfo/Backup/Secret-Handling.

**Impact**
- Regressionen in sicherheits- und datenrelevanten Flows bleiben wahrscheinlich unentdeckt.

**Empfehlung**
- Fokus auf kleine, stabile Tests für Redaction, Import-Validation, Import-Semantik und Alert-Flow.

## Quick Wins (max. 10)

1. API-Key-Anzeige default-masked machen.
2. Dialogtext API-Import an tatsächliches Verhalten angleichen (kurzfristig) oder Verhalten angleichen (mittelfristig).
3. Backup-Import auf schema-validierte Struktur begrenzen.
4. Import-Ergebnis granular ausweisen: `imported`, `skipped-duplicate`, `invalid`.
5. `styles: any` in Komponenten durch `ReturnType<typeof StyleSheet.create>`-kompatiblen Typ ersetzen.
6. `typedProjectData as any` durch gezielten Read-Only-Projekttyp ersetzen.
7. `TemplateInfoSection` mit `useMemo` absichern.
8. Für Full-Backup-Import/Export Versionierungsstrategie klar dokumentieren (v1 strict).
9. Warnhinweise bei Full-Backup um „nicht in Cloud-Chats teilen“ ergänzen.
10. Optional: Telemetrie-freie lokale Audit-Notiz (ohne Secrets), falls Import fehlschlägt.

## Optional Improvements

- „Sensitive Mode“ für gesamte Settings/AppInfo-UI (Blur/Mask standardmäßig, Reveal nur temporär).
- Copy-Buttons mit haptischem Feedback + Timeout-Toast („In Zwischenablage kopiert“) für bessere UX.
- Defensive Limits (z. B. max. Anzahl Keys pro Provider beim Import), um kaputte Dateien abzufangen.

## Test Suggestions (konkret)

1. **Unit:** Redaction-Formatter für API-Keys (leer, kurz, lang, ungültig).
2. **Unit:** Import-Validator lehnt fehlerhafte JSON-Strukturen strikt ab (`apiKeys` nicht `Record<Provider,string[]>`).
3. **Integration (Hook):** API-Import: verifiziert tatsächliches Verhalten (Merge vs Replace) inklusive Ergebniszählung.
4. **UI Test:** ActiveApiKeysSection rendert standardmäßig maskierte Werte und zeigt Klartext nur nach explizitem Reveal.
5. **UI/Logic Test:** Full-Backup-Dialoge zeigen Warnhinweise und brechen bei Cancel ohne Seiteneffekte ab.
