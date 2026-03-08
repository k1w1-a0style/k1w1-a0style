# Deep-Check Analyse: Workflows + Supabase-Interaktionen + MD-Audit

Datum: 2026-03-08  
Repo: `k1w1-a0style`

---

## 1) Ergebnis auf einen Blick

**Kurzfazit:**
- Die Pipeline ist insgesamt **stabil und funktionsfähig** (Typecheck/Lint/Test grün, Workflow-Lint grün, Pinned-Action-Check grün).
- Es gibt aber **2 klar auffällige Drift-/Guard-Probleme** in den Check-Skripten selbst (nicht in den Workflows), die aktuell falsch/falsch-alt schlagen.
- Zusätzlich ist mir ein **auffälliger potenzieller Bug** in einer Supabase-Edge-Function (`github-run-artifact-json`) aufgefallen.
- Also: **nicht „alles perfekt“**, sondern **sehr gut mit gezielten ToDos**.

---

## 2) Durchgeführte Deep-Checks (reproduzierbar)

### Basis-Qualität
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent` ✅ (83/83 Suites grün)
- `npm run docs:lint` ✅
- `node .github/scripts/check-actions-pinned.mjs` ✅
- `actionlint` (lokal via `actionlint-py`) ✅

### Workflow-/Guard-Skripte
- `bash scripts/check_workflow_template_drift.sh` ✅
- `bash scripts/check_eas_manual_trigger_controls.sh` ✅
- `bash scripts/check_eas_production_credentials.sh` ✅
- `bash scripts/check_eas_strict_lockfile_policy.sh` ✅
- `bash scripts/check_edge_helper_visibility.sh` ✅
- `bash scripts/check_k1w1_handler_providers.sh` ✅
- `bash scripts/check_supabase_deploy_workflow.sh` ✅
- `bash scripts/check_managed_workflows.sh` ❌
  - Fehler: erwartet in embedded Workflow-Templates `# workflow-version: 4`, tatsächlicher Stand ist `399`.
- `bash scripts/check_patch_docs_sync.sh` ❌
  - Fehler: erwartet hart auf `Patch 393C`, Repo-Stand ist inzwischen höher (u.a. 398/399/400/401/403).

### Zusätzliche gezielte Invariant-Tests
- `npm run test:silent -- --runInBand edgeHelperVisibility.invariants.test.ts` ✅
- `npm run test:silent -- --runInBand k1w1Handler.providers.invariants.test.ts` ✅

---

## 3) Vollanalyse aller GitHub Workflows

## 3.1 CI/Qualität

### `ci.yml` + `ci-core.yml` + `ci-build.yml`
**Status:** gut
- Klares Setup mit reusable Core (`ci-core.yml`) und separatem App-Trigger (`repository_dispatch`).
- Concurrency gesetzt, Node + `npm ci`, Lint/Typecheck/Tests sauber.
- Positiv: Expo-`projectId` Smoke-Check vorhanden (frühes Failure bei EAS-Link-Problemen).

**Verbesserungsidee (optional):**
- Prüfen, ob `concurrency` in `ci.yml` statt `github.ref` den effektiv gewählten `inputs.ref` stärker berücksichtigt (falls viele manuelle Runs auf unterschiedlichen Refs parallel sinnvoll sein sollen).

### `workflow-lint.yml`
**Status:** sehr gut
- actionlint integriert + SHA-Pin-Check Script.
- Unterstützt Push/PR/Dispatch.

### `codeql.yml`
**Status:** gut
- Standardkonformer Security-Workflow (push/pr/schedule/manual).
- Rechte minimal gehalten (`security-events: write`, sonst read).

---

## 3.2 K1W1 Build-/Diagnose-Flow

### `k1w1-triggered-build.yml`
**Status:** gut
- Sauberer Entry-Workflow für App/Dispatch + manuelle Starts.
- Delegiert auf `eas-build.yml` (reusable), Inputs für `autofix` + `strict_lockfile` vorhanden.

### `eas-build.yml` (managed marker vorhanden, version 403)
**Status:** gut bis sehr gut
- Strikter Build-Flow mit optionalem Autofix-Job.
- Lockfile-Policy differenziert (`auto|true|false`) → robust.
- Preflight-Cleanups gegen „kaputte native folder“-Zustände.
- Permissions/Concurrency klar gesetzt.

**Auffällig / prüfen:**
- Marker-Version 403 ist höher als eingebettete SoT in Edge-Function (399). Das kann gewollt sein (Scope unterschiedlich), ist aber ein Drift-Risiko für Guard-Skripte und sollte dokumentiert bleiben.

### `k1w1-ci-lite.yml` + `k1w1-ci-lite-autofix.yml` (managed marker 399)
**Status:** gut
- Read-only Checks + Autofix-Flow mit Chain-Run/Provenance-Feldern.
- Ergebnis-/Log-Artefakte vorhanden.
- Gute Transparenz für App-Status.

### `k1w1-diagnostics.yml`
**Status:** gut
- Diagnostik erzeugt Artefakte + optional Supabase-Insert.
- Graceful Handling bei fehlenden Supabase Secrets.

### `release-build.yml` (managed marker 403)
**Status:** gut
- Production-Build mit expliziter Secret-Validierung und Keystore-Export via Supabase Edge Function.
- Cleanup von Signing-Dateien vorhanden.

**Verbesserungsidee:**
- Ergänzend prüfen, ob Summary standardisiert immer `WORKFLOW_VERSION` ausgibt (wie in CI-Lite/Supabase-Deploy), um Versions-Traceability zu vereinheitlichen.

---

## 3.3 Supabase Deploy

### `deploy-supabase-functions.yml`
**Status:** gut
- Trigger auf relevante Pfade + manuelle Inputs (`deploy_all`, `function_name`).
- Validierung von `function_name` aktiv.
- Login/Link/Deploy sauber, Metadata-Artifact vorhanden.

**Auffällig:**
- `WORKFLOW_VERSION` steht auf `397`, während andere Workflow-Bereiche bereits auf 399/403 stehen. Kein harter Fehler, aber **Versionsbild uneinheitlich**.

---

## 4) Supabase Functions, die mit Workflows interagieren (Ende-zu-Ende)

## 4.1 Kern-Orchestrierung

### `trigger-eas-build`
- Legt `build_jobs`-Eintrag an.
- Triggert GitHub `repository_dispatch` (`trigger-eas-build`).
- Übergibt Build-Kontext inkl. Profil/Ref/Job-ID.

### `check-eas-build`
- Liest `build_jobs` zurück.
- Liefert normalisierte URLs (`githubRun`, `artifacts`, `buildUrl`) + Sanitization von Fehlertexten.

### `github-workflow-dispatch`
- Allgemeiner `workflow_dispatch`-Dispatcher.
- Kann Workflows nach Name/Alias/ID dispatchen.
- Besitzt Bootstrap-Mechanik für managed Workflows (eingebettete Templates) inkl. Marker-Parsing.
- Schützt gegen flattening/escaped-template-Schäden via `validateWorkflowTemplate`.

### `github-workflow-runs`
- Holt Workflow-Runs (workflow-spezifisch oder Repo-wide fallback).
- Fallback bei 404 verbessert UI-Robustheit.

### `github-workflow-logs`
- Holt und normalisiert Logs + „not ready“-Handling für frühe Polling-Phasen.

### `github-run-artifact-json`
- Lädt ZIP-Artifact, extrahiert JSON-Datei, gibt `text` + `json` zurück.

---

## 4.2 Deaktivierte Legacy-Pfade (bewusst)

- `trigger-lint`, `check-lint`, `check-native-sync`, `trigger-native-sync`, `native-sync-report`, `native-sync-report-ingest` liefern 410/disabled.
- Das ist konsistent, wenn diese Flows produktiv stillgelegt wurden.

**Verbesserungsidee:**
- Optional zentral dokumentieren (eine Tabelle „active vs disabled edge functions“), damit keine falschen Incident-Meldungen entstehen.

---

## 5) Kritische Auffälligkeiten / konkrete Risiken

## A) Guard-Script Drift (hoch, prozessual)
1. `scripts/check_managed_workflows.sh` erwartet embedded `workflow-version: 4`, real ist 399.
2. `scripts/check_patch_docs_sync.sh` ist auf Patch 393C hartkodiert, Repo-Stand ist deutlich weiter.

**Auswirkung:**
- Falsch-negative CI-/lokale Guard-Fehler, obwohl tatsächliche Workflows konsistent sind.

## B) Potenzieller Funktionsbug in `github-run-artifact-json` (mittel/hoch)
- `normalizeZipPath()` enthält auffälliges Regex-Konstrukt (`.replace(/\/g, "/")` wäre erwartbar für Backslash-Normalisierung).
- Aktuelle Form wirkt inkonsistent und könnte Dateipfade aus ZIPs nicht korrekt normalisieren.

**Auswirkung:**
- Artifact-Datei ggf. nicht gefunden, obwohl vorhanden (insb. bei nicht-standardisiertem ZIP-Pfadformat).

## C) Versions-Uneinheitlichkeit (mittel)
- Marker/Versionen sind je Workflowfamilie unterschiedlich (397, 399, 403).
- Kann legitim sein, erzeugt aber Wartungsfriktion und Script-Drift-Risiko.

---

## 6) MD-Dateien / Doku-Deep-Check (gesamt)

Es existieren **429 Markdown-Dateien** im Repo.

### Was geprüft wurde
- Vollständige Datei-Inventur (`rg --files -g '*.md'`) erstellt.
- Docs-Lint erfolgreich (`docsLint: OK`).
- Link-/Docs-Regressionsabdeckung indirekt durch Jest-Suite vorhanden (`docs.indexLinks.test.ts` lief grün).
- Schwerpunktprüfung auf Workflow-/Patch-relevante Kerndokumente (`README.md`, `PROJECT_CHECKLOG.md`, `docs/patches/PATCHLOG_ROOT.md`, `docs/WORKFLOW_PATCHING.md`, `.github/workflows/README.md`).

### Ergebnis
- Dokumentation ist grundsätzlich konsistent und ausführlich.
- Hauptproblem ist nicht fehlende Doku, sondern **statische Guard-Script-Erwartungen**, die mit dem aktuellen Patch-/Workflow-Stand nicht mehr synchron sind.

---

## 7) Antwort auf deine Fragen („Passt jetzt alles? Alles perfekt?“)

**Nein, noch nicht 100% perfekt.**

### Was passt sehr gut
- Pipeline-Basisqualität grün.
- Workflow-Linting und SHA-Pinning sauber.
- Build-/CI-Lite-/Diagnostics-/Supabase-Deploy-Workflows insgesamt robust.
- Sicherheits-/Sanitization-Muster in Supabase-Functions vorhanden.

### Was ergänzt/verbessert werden sollte
1. Guard-Skripte aktualisieren (Managed-Version + Patch-Referenzen).
2. `github-run-artifact-json` Path-Normalisierung gezielt testen/fixen.
3. Versionierungsstrategie (`WORKFLOW_VERSION`/Marker) vereinheitlichen oder explizit dokumentieren.
4. Optional: zentrale Matrix „aktive vs deaktivierte Edge Functions“ in Doku ergänzen.

---

## 8) Priorisierte ToDo-Liste (ohne Codeänderung hier)

**P0 (sofort):**
- `check_managed_workflows.sh` Erwartung für embedded Template-Version anheben/entkoppeln.
- `check_patch_docs_sync.sh` von statischem Patchstand auf dynamische Prüfung umbauen.

**P1:**
- `github-run-artifact-json` `normalizeZipPath()` robust machen + Testfälle für Windows-/verschachtelte ZIP-Pfade.

**P2:**
- Workflow-Versionen standardisieren oder Doku klar nach Workflowfamilie ausweisen.
- Optionales Betriebsdoku-Kapitel zu deaktivierten Edge-Functions.

---

## 9) Gesamturteil

**Status: 8.5/10 – produktionsnah robust, aber mit klaren Wartungs-Drifts in Guarding/Doku-Sync.**

Technisch ist der Kern solide. Die wichtigsten offenen Punkte sind **Prozess-/Guard-Synchronität** und ein **potenzieller Edge-Case-Bug** bei Artifact-Pfadnormalisierung.
