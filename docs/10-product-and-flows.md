# 10 — Product & Flows (Was ist die App? Wie benutzt man sie?)

Stand: 2026-03-01

## Kurzbeschreibung
Diese App ist ein **Build-Orchestrator für React Native Expo**:
- verwaltet **Repo + Branch + Build-Profil**
- prüft die **Build-Readiness** (Gate) über Diagnostics
- patcht/seedet Repo-Infrastruktur (Workflows, eas.json, .gitignore)
- triggert **GitHub Actions** / **EAS Builds** und zeigt Status

> Normative Specs:
> - `docs/01-state-contract.md` (Persistenz/SoT)
> - `docs/02-build-pipeline.md` (Pipeline)
> - `docs/06-build-readiness.md` (Gate)
> - `docs/07-diagnostics-fix-playbook.md` (Fix loops)
> - `docs/08-test-coverage-matrix.md` (Tests)

## Core Journeys

### Journey A — Neues Projekt “buildbar” machen
1) Projekt öffnen/erstellen
2) Repo/Branch verbinden
3) Diagnostics Scan (Local + Pipeline)
4) AutoFix/Manual fixes durchführen, bis Gate grün
5) Build starten (development/preview)

### Journey B — Production Release
1) Secrets vollständig (prod required)
2) production profile korrekt (signing/credentials)
3) Gate grün + Diagnostics last OK
4) Release build triggern + Artefakte verifizieren

## Was ist persistent / Source of Truth (high level)
- **Source of Truth:** explizit gewählte Repo/Branch/Profil (kein stiller fallback)
- **Persistiert:** Tokens, Gate states (z.B. DIAGNOSTIC_LAST_OK), Signing state keys
- Details: `docs/01-state-contract.md`
