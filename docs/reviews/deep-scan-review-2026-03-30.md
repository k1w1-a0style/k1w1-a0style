# Deep Scan Review (kritisch) — 2026-03-30

## Ziel & Scope

Diese Review deckt das gesamte Projekt **k1w1-a0style** ab, mit Fokus auf:

1. Architektur- und Vertragskonsistenz (App, Edge, Workflows, Docs)
2. Laufzeit- und Sicherheitsrisiken in den Kernflüssen
3. Test-/CI-Vertrauensniveau inkl. Flake-Risiko
4. Konkreter, priorisierter **Fixplan** (ohne direkte Codeänderungen in diesem Auftrag)

---

## Methodik (Deep Scan)

Ausgeführt wurden:

- Kontext- und Systemdokumente gelesen (`README.md`, `docs/PROJECT_CONTEXT.md`, `docs/SYSTEM_README.md`, `docs/TODO.md`)
- Vollständige Standard-Qualitätschecks:
  - `npm run typecheck`
  - `npm run lint:ci`
  - `npm run test:silent`
- Erweiterte Flow-/Contract-Checks über die Shell-Skripte:
  - `check_managed_workflows.sh`
  - `check_workflow_template_drift.sh`
  - `check_eas_manual_trigger_controls.sh`
  - `check_eas_production_credentials.sh`
  - `check_eas_strict_lockfile_policy.sh`
  - `check_edge_helper_visibility.sh`
  - `check_k1w1_handler_providers.sh`
  - `check_patch_docs_sync.sh`
  - `check_supabase_deploy_workflow.sh`
  - `check_workflow_edge_contracts.sh`
  - `check_legacy_disabled_edges.sh`
  - `check_supabase_rls_hardening.sh`
  - `check_edge_rate_limit_retention.sh`
- Fokussierter Re-Run des einzigen roten Punktes:
  - `npm run test:silent -- --runInBand __tests__/localRemoteDiffSection.truthfulness.test.tsx`

---

## Executive Summary

### Gesamturteil

**Technischer Zustand: gut bis sehr gut, aber nicht “voll grün reproduzierbar” wegen einer erkennbaren Test-Flakiness im Gesamtlauf.**

### Wichtigste Beobachtungen

- **Typecheck + Lint sind grün.**
- **Alle kritischen Workflow-/Edge-/Security-Contract-Checks sind grün.**
- **Gesamter Jest-Lauf hat 1 Fail (Timeout in einem UI-Truthfulness-Test), der isoliert reproduziert nicht fehlschlägt** ⇒ klassischer Flake-/Timing-Kandidat.
- Die Dokumentations- und Vertragslage ist für ein großes System überraschend konsistent; die bekannten Hardening-Serien (Patch 4xx–6xx) sind in den Prüfroutinen sichtbar stabilisiert.

---

## Kritische Flow-Prüfung

## 1) Repo/Branch/Selection-Truthfulness

**Status:** weitgehend robust, aber mit verbliebener Test-Instabilität.

- Positiv:
  - Starke Vertragsabdeckung in Tests und TODO-/Patch-Historie zu stale async guards, selection SoT und truthfulness.
- Risiko:
  - Timeout im Test `localRemoteDiffSection.truthfulness` im Vollparallel-Lauf zeigt Last-/Scheduler-Sensitivität.

**Bewertung:** kein akuter Produktblocker nach aktuellem Scan, aber **CI-Vertrauen sinkt**, solange dieser Flake nicht systematisch entschärft ist.

## 2) Build-/CI-/Workflow-Orchestrierung

**Status:** stark abgesichert.

- Sämtliche Workflow-Drift-/Contract-Checks laufen erfolgreich.
- Manual Trigger, Lockfile-Policy, Production-Credential-Invarianten und Edge-Workflow-Contracts sind stabil.

**Bewertung:** aktuell **hohes Vertrauen** in die Pipeline-Verträge.

## 3) Edge/Auth/Security-Flows

**Status:** stabil mit guter fail-closed Tendenz.

- RLS-Hardening, Legacy-Disablement und Retention-Contracts schlagen nicht an.
- Provider-Mapping und Edge-Helper-Visibility sind konsistent.

**Bewertung:** aktuell **kein unmittelbarer kritischer Gap** aus den automatisierten Kontrollen sichtbar.

## 4) Docs-/SoT-/Patch-Governance

**Status:** überdurchschnittlich diszipliniert.

- Patch-Dokument-Sync-Check ist grün.
- TODO/Patchlog-Strategie ist klar (historisch detailliert, operative Restliste vorhanden).

**Bewertung:** gute Grundlage, um regressionsarm weiterzuarbeiten.

---

## Befundliste (priorisiert)

## P1 — Flaky Test im Gesamtlauf (Timeout)

**Befund:**
- `npm run test:silent` meldet 1 Fail:
  - `__tests__/localRemoteDiffSection.truthfulness.test.tsx`
  - Timeout in Testfall: `blocks stale diff loads from an old repo/branch after a context switch`
- Isolierter Run (`--runInBand`) ist grün.

**Interpretation:**
- Sehr wahrscheinlich Timing-/Konkurrenzflakiness (nicht stabil reproduzierbarer Produktdefekt).
- Mögliche Ursachen: ausstehende async operations, fake/real timer mix, unzureichende deterministic waits, parallel suite interference.

**Auswirkung:**
- Mittel bis hoch auf CI-Vertrauen, niedrig auf unmittelbare Runtime-Sicherheit.

---

## P2 — Testlaufzeit und Parallel-Last als Drift-Verstärker

**Befund:**
- Sehr große Testmenge (256 Suiten im Lauf); der Gesamtlauf dauert mehrere Minuten.
- Lange Läufe erhöhen Wahrscheinlichkeit zeitlicher Flakes.

**Interpretation:**
- Nicht zwingend Fehlkonfiguration, aber “time-to-signal” und Flake-Risiko steigen.

**Auswirkung:**
- Mittel auf Entwicklergeschwindigkeit und Merge-Vertrauen.

---

## P3 — NPM-Umgebungswarnung (`http-proxy`)

**Befund:**
- Wiederholte Warnung: `npm warn Unknown env config "http-proxy"`.
- Bereits in Projekt-Historie als externer Umgebungsrestpunkt dokumentiert.

**Interpretation:**
- Kein Repo-Code-Bug, aber potenzieller Noise-Faktor in CI/Local.

**Auswirkung:**
- Niedrig technisch, mittel für Signalqualität in Logs.

---

## Fixplan (detailliert, priorisiert)

## Phase 1 (sofort, 0.5–1 Tag) — CI-Vertrauen wiederherstellen

1. **Flaky-Test hart deterministisch machen** (`localRemoteDiffSection.truthfulness`).
   - Async-Pfade explizit kontrollieren (deferred resolution + cleanup).
   - Timer-Strategie vereinheitlichen (entweder konsequent fake timers + controlled advances oder real timers + robust await/waitFor).
   - Test-Isolation stärken (`beforeEach/afterEach`: mocks, timers, unhandled promises).

2. **Stabilitäts-Gate ergänzen** für den betroffenen Testblock.
   - Mehrfachausführung im CI-Probe-Job (z. B. 10x Loop nur für die Suite) als temporärer Nachweis bis stabil.

3. **Timeout-Policy des Einzelfalls dokumentieren**
   - Falls höhere Timeout-Werte nötig sind: nur lokal für betroffene Tests, mit Begründung, nicht global.

**Akzeptanzkriterien:**
- 0/20 Flakes im wiederholten isolierten Lauf.
- 3 aufeinanderfolgende grüne Voll-Läufe in CI.

---

## Phase 2 (kurzfristig, 1–2 Tage) — Testsignal schärfen

1. **Testprofil aufteilen** (schnelle Vertrags-/Invariant-Suiten vs. schwere Integrations-/UI-Suiten).
2. **Optionales CI-Sharding prüfen**, falls Laufzeit weiterhin hoch bleibt.
3. **Flake-Monitoring-Notiz** in `PROJECT_CHECKLOG.md` etablieren (wann/welche Suite/Hostlast betroffen).

**Akzeptanzkriterien:**
- Schnellere frühe Rückmeldung (Fast-Lane).
- Reproduzierbare Zuordnung von Timing-Flakes.

---

## Phase 3 (mittelfristig, 2–4 Tage) — Operative Robustheit & Hygiene

1. **NPM-Warnungsquelle auf Runner-/Host-Ebene bereinigen** (nicht im App-Code), damit Logs ruhiger werden.
2. **Dokumentierte “Trust Follow-up”-Schritte finalisieren** (bereits als offener Punkt in TODO sichtbar).
3. **Rest-`any`-Hotspots weiterhin selektiv abbauen** (nur flow-kritische Bereiche, kein broad cleanup).

**Akzeptanzkriterien:**
- Deutlich weniger Log-Noise.
- Klarer, dokumentierter Green-Path für frischen Checkout + Qualitätschecks.

---

## Konkrete nächste Schritte (empfohlen)

1. Flaky-Test als **Patch mit kleinem Scope** priorisieren (nur Test/Helper, kein Produktverhalten ändern).
2. Danach vollständigen Green-Run (`typecheck`, `lint:ci`, `test:silent`) erneut ausführen.
3. Ergebnis + Flake-Nachweis in Checklog/Patchnote dokumentieren.

---

## Risiko-Matrix (kurz)

- **Security/Edge/Auth:** niedriges aktuelles Risiko (Checks grün)
- **Build-/Workflow-Verträge:** niedriges aktuelles Risiko (Checks grün)
- **Test-Vertrauen/Delivery:** mittleres Risiko (ein Flaky-Kandidat)
- **Dokumentations-/SoT-Drift:** niedrig bis mittel (derzeit gut kontrolliert)

---

## Abschluss

Das Projekt ist in einem **reiferen, klar gehärteten Zustand**. Der entscheidende verbleibende Qualitätshebel ist derzeit nicht Architektur oder Security, sondern **Testdeterminismus im Vollparallel-Lauf**. Wenn Phase 1 umgesetzt wird, ist die nächste Entwicklungswelle mit deutlich besserem Merge-Vertrauen möglich.
