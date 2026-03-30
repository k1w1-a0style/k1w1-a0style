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
| MD-/Notes-Cleanup Kernflächen | **teilweise offen** | Kernnav existiert (`README` + `docs/INDEX`), aber Alt-/Spezialdokus mit veraltetem Stand vorhanden (`docs/TESTING_GUIDE.md`) | niedrig bis mittel (Orientierung/Trust) | kleinen docs-only Sweep mit Fokus auf Kernpfade |
| Dokument-SoT scharf halten | **teilweise offen** | starke Patch-/Checklog-Disziplin, aber sehr lange changelog-lastige README erschwert SoT-Lesen | mittel (Signal/Rauschen) | README stärker auf Navigation/Status kürzen, Verlauf in Patchlog belassen |
| Trust-Follow-up / Green-Path frischer Checkout | **teilweise offen** | TODO fordert explizite Green-Path-Doku; `package.json` Scripts klar, aber zentrale frische-Checkout-Anleitung ist fragmentiert/teils veraltet | mittel (Onboarding, reproduzierbare Verifikation) | kompakten „Fresh Checkout Green Path“ zentral dokumentieren |
| Rest-`any` selektiv abbauen | **bestätigt offen** | `docs/04-risk-hotspots.md` listet verbleibende Runtime-Hotspots explizit | mittel (punktuelle Runtime-/Error-Contract-Risiken) | A-Restpunkte weiter in kleinen testgetriebenen Patches |
| CS-REST-001 Busy-UX für `testEas` | **bestätigt offen (klein)** | `testEas` nutzt nicht `withBusyGuard`; frühes `return` bei `busyRef.current` ohne explizites Busy-Feedback | niedrig bis mittel (UX-Uneindeutigkeit) | Busy-Verhalten für `testEas` an Guard-/Feedback-Semantik angleichen |

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

- **Status:** teilweise offen.
- **Begründung:** Kernnavigation ist vorhanden, aber z. B. `docs/TESTING_GUIDE.md` enthält klar veraltete/umgebungsfremde Angaben (Pfad `/vercel/sandbox`, alte Testsuite-Größen).
- **Risiko/Auswirkung:** mittel für Vertrauen in Doku, niedrig für Runtime.
- **Priorität:** P3.
- **Kleinster nächster Schritt:** 1 kompakter docs-only Patch: veraltete Guide-Inhalte als „historisch“ markieren oder auf aktuellen Green-Path umstellen.

### 3) Dokument-SoT scharf halten

- **Status:** teilweise offen.
- **Begründung:** SoT-Disziplin ist grundsätzlich gut (Patch-/Checklog stark), aber operative Kernaussagen sind durch sehr lange Verlaufsblöcke schwerer auffindbar.
- **Risiko/Auswirkung:** mittel für Wartbarkeit und schnelle Verifikation.
- **Priorität:** P3.
- **Kleinster nächster Schritt:** README weiter auf „Status + Navigation + Verträge“ fokussieren; Historie konsequent im Patchlog halten.

### 4) Trust-Follow-up / Green-Path frischer Checkout

- **Status:** teilweise offen.
- **Begründung:** TODO fordert expliziten Green-Path (`npm ci`, Typecheck, Lint, Tests). Die Bausteine sind vorhanden, aber nicht als ein kurzer verbindlicher Ablauf an einer zentralen Stelle.
- **Risiko/Auswirkung:** mittel für Onboarding-/Audit-Reproduzierbarkeit.
- **Priorität:** P2.
- **Kleinster nächster Schritt:** kurze zentrale „Fresh Checkout Checklist“ (Voraussetzungen + 4 Befehle + erwartete Signale + bekannte externe Warnung `http-proxy`).

### 5) Rest-`any` selektiv abbauen

- **Status:** bestätigt offen.
- **Begründung:** `docs/04-risk-hotspots.md` dokumentiert offene A-Restpunkte explizit und priorisiert; dieser Punkt ist weder vergessen noch künstlich offen.
- **Risiko/Auswirkung:** mittel (selektive Runtime-/Error-Pfade).
- **Priorität:** P2.
- **Kleinster nächster Schritt:** nächster A-Punkt (`lib/diagnostics/ciAutoFix.ts`) mit engem Testscope.

### 6) CS-REST-001: Busy-UX für `testEas` konsistent

- **Status:** bestätigt offen (kleiner UX-Rest).
- **Begründung:** `testEas` läuft außerhalb `withBusyGuard`; bei aktivem `busyRef` wird nur früh returned. Dadurch ist das Verhalten korrekt konservativ, aber Busy-Feedback nicht im selben Muster wie andere Test-/Save-Aktionen.
- **Risiko/Auswirkung:** niedrig bis mittel (UX-Wahrheit/Bedienklarheit), kein harter Security-/Build-Vertrag.
- **Priorität:** P2/P3 (klein, aber usernah).
- **Kleinster nächster Schritt:** `testEas` auf dieselbe Busy-Feedback-Semantik ziehen (z. B. dedizierter Hinweis bei Busy-Kollision statt stillem Return).

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

1. **Veraltete Test-/Onboarding-Doku (`docs/TESTING_GUIDE.md`)**
   - Konkrete veraltete Inhalte vorhanden.
   - Priorität: P3 (Trust/Onboarding, nicht Runtime).

2. **Busy-UX-Inkonsistenz für `testEas`**
   - Bereits in TODO benannt, im Code sichtbar.
   - Priorität: P2/P3 (kleiner, klarer UX-Fix).

Keine zusätzlichen „neuen Großbaustellen“ wurden künstlich aufgemacht.

---

## Konkrete nächste Schritte

1. **Kleiner UX-Patch (P2/P3):** `testEas` Busy-Kollisionsfeedback konsistent machen.
2. **Kleiner Docs-Patch (P2/P3):** „Fresh Checkout Green Path“ zentral und knapp dokumentieren.
3. **Kleiner Docs-Cleanup (P3):** `docs/TESTING_GUIDE.md` auf aktuellen, realen Stand ziehen oder klar als historisch markieren.
4. **Danach selektiv Runtime-Hotspots (P2):** nächster `any`-A-Punkt mit engem Testfokus.
5. **Truthfulness-Hotspot beobachten:** keine künstliche Wiedereröffnung; nur bei erneutem CI-Symptom gezielt nachschärfen.

---

## Schlussfazit (nüchtern)

Das Projekt wirkt im aktuellen Stand technisch stabil und stark gehärtet. Die offenen Punkte sind mehrheitlich **klein**, klar eingrenzbar und teilweise bewusst optional bzw. extern-operativ. Der zentrale Truthfulness-/Flake-Punkt ist derzeit eher ein **Determinismus-/Testumgebungs-Thema** als ein bestätigter Produktdefekt; er bleibt ein Beobachtungs-Hotspot, aber kein Anlass für breitflächigen Umbau.
