# 10 — Product and Flows

Stand: **2026-03-17 (Patch 477)**

## Produktkern

Die App orchestriert Repo-/Build-/Diagnose-Arbeitsschritte für Operatoren in einer klaren Sequenz:

`GitHub Repos` → `Verbindungen` → `Diagnose` → `Build` → `Status/History`

Ziel: reproduzierbare, transparente Build-Starts ohne stille Fallbacks.

## Verbindliche Flow-Regeln

1. **Repo/Branch zuerst**
   - Auswahl stammt aus `projectData.linked*`.
   - Kein stilles „nimm einfach main“ in produktiven Flows.

2. **Diagnostics vor Build**
   - Build-Gate öffnet erst mit grünem Diagnosezustand.
   - FAIL/WARN werden über Fix-Loop oder manuelle Maßnahmen geschlossen.

3. **Explizite Workflow-Refs**
   - Produktive Deploy-/Build-Workflows bleiben ref-gesteuert.
   - Branch-basierte CI-Lite-Chain ist eine dokumentierte Ausnahme.

4. **Vertragsklarheit bei IDs**
   - Build-Jobs liefern eine **positive numerische `jobId`** (bigint-backed).
   - Diagnostics-Upload-ID wird im Client als opaque string behandelt.

## Haupt-Journeys

### A) Happy Path (Operator)

1. Repo + Branch setzen
2. Tokens/Verbindungen prüfen
3. Diagnostics scannen und Restfehler fixen
4. Build-Profil wählen (z. B. `production`)
5. Build starten und Status prüfen

**Erwartung:** kein Gate-Blocker, nachvollziehbare Status-/Historie-Einträge.

### B) Fix-Loop bei roten Checks

1. In `Diagnose` scannen
2. Betroffenen Check öffnen
3. `Auto-Fix` oder manuelle Korrektur
4. Recheck ausführen
5. Erst dann Build freigeben

**Erwartung:** klarer Fortschritt statt verdeckter Fallbacks.

### C) Production Readiness

- Signing-/Credential-Status im Wizard prüfen
- Repo-Secrets validieren/synchronisieren
- Letzten Diagnostics-Stand bestätigen

**Erwartung:** Produktionsbuild startet kontrolliert und reproduzierbar.

## Non-Goals

- Kein Ersatz für native GitHub-/EAS-Debug-UIs.
- Keine automatische Secret-Rotation/Forensik.
- Kein stilles Erraten fehlender Betriebsparameter.

## Verweise

- Build-Readiness: `docs/06-build-readiness.md`
- Diagnostics/Fix: `docs/07-diagnostics-fix-playbook.md`
- Smoke-Plan: `docs/04-testing-smoke-plan.md`
- Runbook: `docs/runbooks/APP_RUNBOOK.md`
