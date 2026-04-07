# Dokumentations-Index

Stand: **2026-04-07 (Patch 749, Preview-Legacy-Removal: Query-Secret-Bridge entfernt)**

Dieser Index ist der **kanonische Einstieg** in die aktive Doku. Historische Detailnotizen bleiben im Patchlog-Archiv und werden hier nicht doppelt erklaert.

## 1) Zuerst lesen

1. [README.md](../README.md) — kompakter Repo-Stand + Verify-Entry
2. [00-overview.md](00-overview.md) — Architektur, SoT, Leitplanken
3. [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) — Produktziel, Betriebsmodell, Nicht-Ziele
4. [SYSTEM_README.md](SYSTEM_README.md) — aktuelle Systemregeln fuer Agenten / Arbeitskontext
5. [reviews/Review.md](reviews/Review.md) — kanonische aktuelle Review
6. [TODO.md](TODO.md) — kompakte Restpunkt-/Betriebs-SoT

## 2) Betrieb / Verifikation

- [FRESH_CHECKOUT_GREEN_PATH.md](FRESH_CHECKOUT_GREEN_PATH.md) — frischer Checkout, lokal reproduzierbar
- [TESTING_GUIDE.md](TESTING_GUIDE.md) — Test-/Verify-Pfad
- [06-build-readiness.md](06-build-readiness.md) — Gate-Regeln, Operator-Vertrag, Build-Blocker
- [EDGE_FUNCTIONS_STATUS.md](EDGE_FUNCTIONS_STATUS.md) — aktive / deaktivierte Edge-Funktionen
- [runbooks/APP_RUNBOOK.md](runbooks/APP_RUNBOOK.md) — operatorischer Ablauf
- [runbooks/OPERATOR_SETUP_CHECKLIST.md](runbooks/OPERATOR_SETUP_CHECKLIST.md) — externes `build_admin`-Provisioning
- [runbooks/OPERATOR_EXECUTION_CHECKLIST.md](runbooks/OPERATOR_EXECUTION_CHECKLIST.md) — abhakbarer Live-/Staging-Ausfuehrungspfad
- [runbooks/SUPABASE_DEPLOY_AND_MIGRATIONS.md](runbooks/SUPABASE_DEPLOY_AND_MIGRATIONS.md) — Deploy / Migrationen
- [DEV_COMMANDS.md](DEV_COMMANDS.md) — kompakte Repo-Kommandos

## 3) Architektur / Flows / Referenz

- [01-state-contract.md](01-state-contract.md) — State-/Storage-SoT
- [02-build-pipeline.md](02-build-pipeline.md) — Build-/Workflow-Pipeline
- [03-screen-index.md](03-screen-index.md) — Screens und primaere Aktionen
- [10-product-and-flows.md](10-product-and-flows.md) — Produktfluesse
- [13-screen-flow-map.md](13-screen-flow-map.md) — End-to-End-Flow-Map
- [14-state-quickref.md](14-state-quickref.md) — kompakte State-/Storage-Referenz
- [04-risk-hotspots.md](04-risk-hotspots.md) — **historischer** Audit-/Patch-Kontext, nicht die aktive TODO-Liste
- [patches/ARCHIVE_INDEX.md](patches/ARCHIVE_INDEX.md) — leichter Einstieg ins historische Patch-Archiv
- [04-testing-smoke-plan.md](04-testing-smoke-plan.md) — manueller Smoke-Plan
- [08-test-coverage-matrix.md](08-test-coverage-matrix.md) — aktive Test-/Coverage-Matrix
- [07-diagnostics-fix-playbook.md](07-diagnostics-fix-playbook.md) — Diagnostics-/Fix-Playbook

## 4) Patch-/Historienarchiv

- [WORKFLOW_PATCHING.md](WORKFLOW_PATCHING.md) — kanonischer Patch-Workflow
- [../PROJECT_CHECKLOG.md](../PROJECT_CHECKLOG.md) — kurzer laufender Checklog
- [patches/PATCHLOG_ROOT.md](patches/PATCHLOG_ROOT.md) — append-only Patchhistorie
- [patches/README.md](patches/README.md) — Einordnung des Patch-Archivs

## 5) Was bewusst **nicht** mehr aktiv dupliziert wird

- alte Parallel-Reviews
- alte Statusreports
- alte Refactor-Planungsdateien
- alte einmalige Scan-/Zusammenfassungs-MDs im Repo-Root

Die aktive Wahrheit bleibt klein: README, INDEX, OVERVIEW, REVIEW, TODO, Runbooks.
