# Deep Scan Review (Follow-up, evidenzbasiert) — 2026-03-30

## Ziel & Scope

Diese Follow-up-Analyse ersetzt keine Detail-Fixplanung, sondern verifiziert die bisherige Review gegen den **aktuellen Repo-Stand**.
Fokus:

1. offene Punkte aus `docs/TODO.md` einzeln und mit Beleg einstufen,
2. Truthfulness-/Flake-Hotspot technisch schärfer einordnen,
3. Aussagen aus der bisherigen Review in **belastbar vs. Indiz** trennen,
4. externe Betriebsrestpunkte klar von Repo-Code-Restpunkten trennen.

## Verifikationsbasis

Querprüfung über:

- `docs/reviews/deep-scan-review-2026-03-30.md` (Ausgangslage)
- `docs/TODO.md`
- `PROJECT_CHECKLOG.md`
- `docs/04-risk-hotspots.md`
- `README.md`
- `package.json`
- `jest.setup.js`
- Hotspots in Code/Test:
  - `__tests__/localRemoteDiffSection.truthfulness.test.tsx`
  - `screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx`
  - `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`
  - `screens/EnhancedBuildScreen/components/BuildHistorySection.tsx`
  - `docs/TESTING_GUIDE.md`

Zusätzlich ausgeführte Verifikation:

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- 12x Serienlauf der Truthfulness-Suite (`--runInBand`) zur Flake-Prüfung

---

## Follow-up-Verifikation der offenen Punkte

### Kompakte Einstufungstabelle

| Punkt | Status | Evidenz | Risiko | Empfehlung |
|---|---|---|---|---|
| BuildScreen-Restpunkt Export-Wording (`Copy JSON` / `Share CSV`) | **bewusst optional** | UI ist funktional, nur Label-Mix DE/EN in `BuildHistorySection.tsx` | niedrig (Kosmetik) | nur bei echtem UX-Bedarf umbenennen |
| MD-/Notes-Cleanup Kernflächen | **im Kern geschlossen** | Kern-MDs (`README`, `INDEX`, `TESTING_GUIDE`, `FRESH_CHECKOUT_GREEN_PATH`) auf aktuellen Stand gezogen | niedrig (Rest = laufende Pflege) | nur noch punktuell bei neuen Patch-Scope-Änderungen nachziehen |
| Dokument-SoT scharf halten | **verbessert, laufende Daueraufgabe** | Patch-/Checklog-Disziplin ist stark; Kernwidersprüche wurden bereinigt | niedrig bis mittel (Signal/Rauschen) | README langfristig weiter auf Navigation/Status fokussieren |
| Trust-Follow-up / Green-Path frischer Checkout | **geschlossen** | Green-Path ist zentral dokumentiert und aktuell (`docs/FRESH_CHECKOUT_GREEN_PATH.md`) | niedrig | als verbindliche Referenz beibehalten |
| Rest-`any` selektiv abbauen | **bestätigt offen** | `docs/04-risk-hotspots.md` listet verbleibende Runtime-Hotspots explizit | mittel (punktuelle Runtime-/Error-Contract-Risiken) | A-Restpunkte weiter in kleinen testgetriebenen Patches |
| CS-REST-001 Busy-UX für `testEas` | **geschlossen** | in `docs/TODO.md` als erledigt markiert (Patch 626), Busy-Kollisionen haben explizites Feedback | niedrig | beobachten, kein akuter Restpunkt |

---

## A) Truthfulness-/Flaky-Hotspot: technische Neubewertung

### Befund

- Die Suite `__tests__/localRemoteDiffSection.truthfulness.test.tsx` ist aktuell grün (auch im Volltestlauf).
- Ein 12x-Serienlauf in `--runInBand` war vollständig grün.
- `jest.setup.js` setzt global 20s Timeout, nutzt aggressive Cleanup-/Mock-Resets und blockt echte Netzwerkkonnektivität.
- `LocalRemoteDiffSection.tsx` enthält umfangreiche asynchrone Guard-Mechanik (`genRef`, `previewReqRef`, `mountedRef`, `truthKey`, Kontext-/Fingerprint-Invalidierung).

### Einordnung: Test-Determinismus vs. Runtime-Defekt

**Stärkerer Befund:** aktuell eher **Test-Determinismus-/Scheduling-Thema** als klarer Runtime-Produktdefekt.

Begründung:

1. Die Komponente enthält bereits explizite stale-request Guards für Kontextwechsel.
2. Der historische Fix ist im Checklog dokumentiert (Patch 494), inkl. genau dieser Race-/Stale-Thematik.
3. Der Fehler trat laut Ausgangsreview als Timeout im Vollparallel-Lauf auf, nicht als stabil reproduzierbarer Logikfehler.
4. Re-Tests liefern derzeit keinen reproduzierbaren Produktfehler.

### Stärkste Hypothese

Die wahrscheinlichste Ursache bleibt **last-/scheduler-sensitive Test-Interaktion** (nicht deterministische Await-/Render-Reihenfolge unter Vollsuite-Last), nicht ein grundsätzlich falscher Produktionszustand in `LocalRemoteDiffSection`.

### Kleinste plausible nächste Maßnahme

- Nur die betroffene Suite minimal härten (ohne Runtime-Verhalten zu ändern):
  - explizite helper für stabile Synchronisationspunkte (`waitFor` auf klaren UI-Endzustand nach jeder kritischen Aktion),
  - optional CI-Probe-Loop für diese Suite (temporär),
  - keine globalen Timeout-Erhöhungen.

### Regressions-Hotspot?

**Ja, als Prozess-Hotspot** (nicht zwingend als Runtime-Regressions-Hotspot):

- Checklog führt den Bereich bereits als geschlossenen Hardening-Punkt,
- die Deep-Scan-Ausgangsreview meldete später erneut Flake-Symptom,
- aktuell ist es nicht reproduzierbar rot.

Interpretation: „geschlossen“ war fachlich plausibel, aber die Stelle bleibt sensibel für Testumgebung/Parallelität.

---

## B) Einzeleinstufung der TODO-Open-Items

### 1) BuildScreen-Restpunkt (optional): deutsches Wording Export-Aktionen

- **Status:** bewusst optional.
- **Begründung:** In `BuildHistorySection.tsx` sind Labels `Copy JSON` / `Share CSV` englisch, restlicher Screen überwiegend deutsch.
- **Risiko/Auswirkung:** niedrig, rein sprachliche Konsistenz.
- **Priorität:** P4 (kosmetisch).
- **Kleinster nächster Schritt:** zwei Label-Strings lokalisieren, keine Logikänderung.

### 2) MD-/Notes-Cleanup Kernflächen

- **Status:** im Kern geschlossen.
- **Begründung:** Kern-MDs wurden auf denselben Patchstand gezogen; die früher veralteten Stand-Header sind bereinigt.
- **Risiko/Auswirkung:** niedrig für Runtime, niedrig bis mittel für laufende Pflege.
- **Priorität:** P3 (nur kontinuierliche Pflege).
- **Kleinster nächster Schritt:** keine Sondermaßnahme; bei jedem Patch den Kern-MD-Sync strikt mitlaufen lassen.

### 3) Dokument-SoT scharf halten

- **Status:** verbessert, aber als Daueraufgabe laufend.
- **Begründung:** zentrale Widersprüche sind bereinigt; verbleibender Optimierungsbedarf ist Struktur-/Lesbarkeit, nicht fachliche Inkonsistenz.
- **Risiko/Auswirkung:** mittel für Wartbarkeit, niedrig für Runtime.
- **Priorität:** P3.
- **Kleinster nächster Schritt:** bei Gelegenheit README-Historienblock weiter kürzen, ohne Informationsverlust.

### 4) Trust-Follow-up / Green-Path frischer Checkout

- **Status:** geschlossen.
- **Begründung:** der Green-Path ist zentral und aktuell dokumentiert (`docs/FRESH_CHECKOUT_GREEN_PATH.md` + `docs/TESTING_GUIDE.md`).
- **Risiko/Auswirkung:** niedrig.
- **Priorität:** P3 (Erhalt).
- **Kleinster nächster Schritt:** nur bei Prozessänderungen aktualisieren.

### 5) Rest-`any` selektiv abbauen

- **Status:** bestätigt offen.
- **Begründung:** `docs/04-risk-hotspots.md` dokumentiert offene A-Restpunkte explizit und priorisiert; dieser Punkt ist weder vergessen noch künstlich offen.
- **Risiko/Auswirkung:** mittel (selektive Runtime-/Error-Pfade).
- **Priorität:** P2.
- **Kleinster nächster Schritt:** nächster A-Punkt (`lib/diagnostics/ciAutoFix.ts`) mit engem Testscope.

### 6) CS-REST-001: Busy-UX für `testEas` konsistent

- **Status:** geschlossen.
- **Begründung:** ist in `docs/TODO.md` als erledigt dokumentiert (Patch 626), inkl. explizitem Busy-Feedback.
- **Risiko/Auswirkung:** niedrig.
- **Priorität:** keine aktive Restpriorität.
- **Kleinster nächster Schritt:** nur Regression beobachten.

---

## Evidenzbasierte Neubewertung

### Wo die bisherige Review zu grob ist

1. **Flake-Punkt zu pauschal:** „Flaky-Test“ stimmt als Symptom, aber die Trennung zwischen Runtime-Defekt und Testdeterminismus war zu wenig explizit.
2. **Offene TODO-Punkte nicht einzeln klassifiziert:** optional / extern / nicht bestätigt war noch nicht hart getrennt.
3. **Dokumentationsrestpunkte zu allgemein:** fehlende konkrete Gegenbeispiele (z. B. veraltete Test-Doku).

### Welche Aussagen belastbar sind

- Qualitätssignale (`typecheck`, `lint:ci`, `test:silent`) sind aktuell grün.
- Security-/Workflow-Hardening ist im Repo breit durch Invariants + Checks verankert.
- Offene TODO-Reste sind überwiegend kleine, klar begrenzte Punkte (kein großer verdeckter Architekturbruch sichtbar).

### Welche Aussagen nur Indizien sind

- „Der Truthfulness-Block ist endgültig stabil“ wäre aktuell überzogen; es gibt **kein** aktuelles Rot-Signal, aber die Historie zeigt Sensitivität.
- „Dokument-SoT ist vollständig scharf“ ist ebenfalls nur teilweise belegt; es gibt weiterhin Alt-/Noise-Reste.

---

## Nicht bestätigte oder bewusst externe Punkte

### Nicht bestätigt (im aktuellen Stand)

- Ein aktueller reproduzierbarer Runtime-Produktdefekt im `LocalRemoteDiffSection` konnte in dieser Verifikation **nicht bestätigt** werden.
- Ein akuter Build-/Workflow-Vertragsbruch aus den aktuellen TODO-Restpunkten ist nicht sichtbar.

### Bewusst außerhalb Repo-Code

- Operative Supabase-/Operator-Schritte (Claim-Vergabe, Secret-Rotation, produktive Betriebsführung) bleiben weiterhin **außerhalb Repo-Code**, konsistent zur TODO-Klassifikation.
- Die `npm warn Unknown env config "http-proxy"`-Warnung bleibt ein externer Umgebungsrestpunkt (bereits so dokumentiert), kein belastbarer Repo-Code-Fixpunkt.

---

## Weitere echte, derzeit unterbewertete Restpunkte (klein, aber real)

1. **Test-`as any`-Dichte in mehreren Suiten**
   - Kein akuter Runtime-Defekt, aber schwächerer Typvertrag in Refactor-nahen Tests.
   - Priorität: P2.

2. **README-Lesbarkeit (lange Historienblöcke)**
   - Fachlich konsistent, aber operativ schwerer scanbar.
   - Priorität: P3.

Keine zusätzlichen „neuen Großbaustellen“ wurden künstlich aufgemacht.

---

## Konkrete nächste Schritte

1. **Selektiver Test-Typing-Pass (P2):** `as any`-intensive Test-Fixtures in kleinen Paketen straffen.
2. **README-Lesbarkeits-Pass (P3):** Historienblock behutsam kürzen, SoT-Links prominent halten.
3. **Truthfulness-Hotspot beobachten:** keine künstliche Wiedereröffnung; nur bei erneutem CI-Symptom gezielt nachschärfen.

---

## Schlussfazit (nüchtern)

Das Projekt wirkt im aktuellen Stand technisch stabil und stark gehärtet. Die offenen Punkte sind mehrheitlich **klein**, klar eingrenzbar und teilweise bewusst optional bzw. extern-operativ. Der zentrale Truthfulness-/Flake-Punkt ist derzeit eher ein **Determinismus-/Testumgebungs-Thema** als ein bestätigter Produktdefekt; er bleibt ein Beobachtungs-Hotspot, aber kein Anlass für breitflächigen Umbau.

---

## Addendum (aktueller Nachscan, 2026-03-30, Patch 636)

### Was zusätzlich geprüft wurde

- Laufzeit-/Hook-Hotspots (Größencheck):
  `hooks/useChatAIFlow.ts` (993), `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts` (1087), `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts` (941), `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts` (1066), `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts` (906), `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts` (698).
- Rest-`as any` Inventar (codefokussiert, ohne `docs/**`, `README.md`, `PROJECT_CHECKLOG.md`).
- TODO/FIXME/HACK-Scan.
- Konsistenzcheck für Doku-Sync mit `node scripts/docsLint.js` und `bash scripts/check_patch_docs_sync.sh`.

### Ampelsystem (kritische Follow-ups)

| Prio | Befund | Ort | Warum relevant | Fixmöglichkeit |
|---|---|---|---|---|
| P0 | **Kein neuer bestätigter P0-Produktdefekt** | Nachscan gesamt | Security-/Workflow-Contracts bleiben durch Invariants/Scripts abgesichert. | Weiter so: fail-closed Checks + Invariants nicht aufweichen. |
| P1 | **Monolithische Hook-Hotspots bleiben wartungsriskant** | `hooks/useChatAIFlow.ts`, `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`, `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts` | Hohe Änderungsfläche erhöht Regressionswahrscheinlichkeit trotz Tests. | Weitere kleine pure-logic Extraktionen (Notice-/Mapping-/Guard-Blöcke), jeweils mit fokussierten Unit-Tests und ohne Flow-Umbau. |
| P2 | **Testlastige `as any`-Reste** (größtenteils in Tests) | u. a. `lib/__tests__/buildStartService.integration.test.ts`, `__tests__/useDiagnosticFixRunner.fixSemantics.test.tsx`, `__tests__/repoSyncOrchestration.test.ts` | Kein akuter Runtime-Defekt, aber Typvertragsrauschen in Regressionstests. | Selektiver Test-Typing-Cleanup in kleinen Chargen (Fixtures/Factories enger typisieren). |
| P2 | **Docs-Navigations-/SoT-Rauschen** | `README.md` (sehr lange Historienblöcke), verteilt in Patch-/Review-Notizen | Erschwert schnellen Einstieg trotz guter Datenlage. | README weiter als Navigations-SoT kürzen; historische Tiefe in Patchlog/Reviews belassen. |

### ASNI-Einträge (Action / Scope / Need / Impact)

1. **A:** `refreshSyncStatus` invalid-repo Fehlerstatus setzen.
   **S:** `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
   **N:** Verhindert stale Sync-Lampe bei ungueltigem `owner/repo`.
   **I:** Kleine Correctness-/UX-Härtung, regressionsarm.
2. **A:** `invalid_repo` Precheck-Test ergänzen.
   **S:** `__tests__/useGitHubReposScreenHelpers.test.ts`
   **N:** Deterministischer Nachweis des neuen Guard-Zweigs.
   **I:** Höhere Refactor-Sicherheit.
3. **A:** Monolith-Hook-Extraktionen weiter priorisieren.
   **S:** Hook-Hotspots (siehe Ampel P1).
   **N:** Wartbarkeit und Review-Fähigkeit verbessern.
   **I:** Mittelfristig geringere Regressionen bei Feature-Fixes.

### Dead-Code-/Cleanup-Kandidaten (kritisch geprüft)

- **Nicht bestätigt:** echter produktiver Dead-Code-Block, der sofort gelöscht werden sollte.
- **Beobachtung:** mehrere große Workflow-/Template-String-Dateien enthalten absichtlich eingebettete `console.*`/Shell-Fragmente (Template-Inhalt, kein Runtime-Logger-Leak).
- **Empfehlung:** bei künftigen Scans `templates/**` und `shared/workflows/**` bei Log-Regex getrennt auswerten, um False-Positives sauber zu isolieren.

### Test-Audit (Korrektheit + Verbesserungsmöglichkeiten, finaler Nachzug)

#### Bereits als Fix-Beispiel umgesetzt

- **Determinismus-Fix:** `__tests__/buildReadinessGate.ciLiteFreshness.test.ts`
  - Problem: Test nutzte mehrfach direkt `Date.now()` (Fixture + Assertions), was in Grenzfällen zeitabhängig sein kann.
  - Fix: feste Zeitbasis (`FIXED_NOW`) + `jest.spyOn(Date, "now").mockReturnValue(FIXED_NOW)` + Restore in `afterEach`.
  - Nutzen: reproduzierbarere Laufzeit, klarere Failure-Ursachen, weniger Flake-Risiko.

#### Weitere sinnvolle Test-Verbesserungen (mit Begründung + Fixoption)

1. **P1 (Test-Qualität): zentrale typed Test-Fixtures statt wiederholtem `as any`**
   - Betroffene Stellen: z. B. `lib/__tests__/buildStartService.integration.test.ts`, `__tests__/useDiagnosticFixRunner.fixSemantics.test.tsx`, `__tests__/repoSyncOrchestration.test.ts`.
   - Begründung: viele `as any` kaschieren Vertragsdrift und schwächen Refactor-Sicherheit.
   - Fixoption: `test/fixtures/*.ts` mit strikt typisierten Factory-Helpern (`makeProjectData`, `makeProjectFile`, `makeWorkflowRun`) und schrittweise Migration.

2. **P2 (Test-Wartbarkeit): Zeit-/Freshness-Tests systematisch auf feste Uhr umstellen**
   - Betroffene Muster: `Date.now()` in Build-Readiness-/CI-Freshness-/History-Tests.
   - Begründung: verteilte Zeitquellen erschweren Diagnose bei sporadischen Grenzfehlern.
   - Fixoption: kleines `withFixedNow(...)` Test-Utility oder per-Suite-`Date.now`-Mock als Standardmuster.

3. **P2 (Signal/Rauschen): Invariant-Regex-Scans um False-Positive-Filter ergänzen**
   - Betroffene Muster: Log-/Console-Scans treffen teils Template-Stringinhalte.
   - Begründung: echte Runtime-Funde gehen leichter im Output-Rauschen unter.
   - Fixoption: Scanpfade in Invariant-Suites stärker auf Runtime-Code fokussieren und Templates separat berichten.


## Addendum II (SoT-/Debt-Rebaseline, 2026-03-30, Patch 638)

### Bestaetigte reale Drifts

1. **Stand-Header-Drift in Kern-MDs:** `docs/INDEX.md`, `docs/TESTING_GUIDE.md` und `docs/FRESH_CHECKOUT_GREEN_PATH.md` standen noch auf Patch 636, obwohl TODO/README/Patchlog bereits weiter waren.
2. **Typing-Lage in Hotspot-Doku veraltet fokussiert:** `docs/04-risk-hotspots.md` enthielt viele Historienupdates, aber keinen klaren frischen Gesamtzaehler inkl. `: any`-Lage.

### Nachgezogene Korrektur

- Kern-Header auf denselben Patchstand synchronisiert.
- `as any`/`: any`-Inventar neu erhoben und explizit in Runtime-vs-Test/Historie getrennt.
- Bewertungsfokus entsprechend verschaerft: naechste Hebel sind `: any` in produktionsnahen Pfaden und kleine testgetriebene Hook-Entkopplungen, **kein** Broad-Refactor.

### Nicht bestaetigt (bewusst nicht geaendert)

- Kein neuer reproduzierbarer P0/P1-Runtime-Defekt.
- Keine neue Auth-/Workflow-/RLS-Vertragsabweichung.
- Keine zusaetzliche Verfahrensluecke in `AGENTS.md`, die ueber den bereits verpflichtenden Kern-MD-/SoT-Abgleich hinausgeht.
