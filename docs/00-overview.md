# 00 — Overview (Single Source of Truth)

## Zweck
Dieses Dokument beschreibt den verbindlichen Rahmen für:
- globalen Zustand (Repo/Branch/BuildProfile + diagnostische Persistenz),
- Build-Pipeline (UI → Context → Service → GitHub/Supabase),
- Guardrails gegen Drift (Hardcoding/Fallbacks/lokale Schattenkopien).

Normative Details liegen in:
- `docs/01-state-contract.md`
- `docs/02-build-pipeline.md`

## Operative Kernkette
1. **Auswahl setzen** in `GitHub Repos` (Repo/Branch).
2. **Verbindungen prüfen** in `Connections`.
3. **Diagnose/Fix-Loop** in `Diagnose`.
4. **Build starten** in `Build`.

## Contract-Kernaussagen
- SoT für Auswahl bleibt `projectData.linkedRepo` / `projectData.linkedBranch`.
- Build-Start bleibt zentral über `ProjectContext.startBuild` → `startBuildJob`.
- Build-Gates bleiben aktiv (u. a. Branch vorhanden + `diagnostic_last_ok`).
- Workflow-/Template-Drift wird über Guard-Skripte + Invariant-Tests abgesichert.

## Begriffe
- **SoT:** autoritative Datenquelle.
- **Single Writer:** definierter Schreibpfad pro Vertragswert.
- **Mirror State:** abgeleiteter UX-Zustand, nicht primäre Autorität.
- **Guardrail:** technische Sperre gegen ungültige Starts/Fallbacks.

## Weiterführende Links
- Produkt/Journeys: `docs/10-product-and-flows.md`
- Screen-Index: `docs/03-screen-index.md`
- Flow-Map: `docs/13-screen-flow-map.md`
- Build-Readiness: `docs/06-build-readiness.md`
- Diagnostics/Fix-Playbook: `docs/07-diagnostics-fix-playbook.md`
- Runbook: `docs/runbooks/APP_RUNBOOK.md`
