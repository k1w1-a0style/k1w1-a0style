# App Runbook (QA / Operator)

Stand: **2026-04-02 (Docs Konsolidierung)**

Ziel: In <30 Minuten reproduzierbar von „frisches Setup“ zu „Build gestartet“ inkl. klarer Failure- und Re-Run-Entscheidungen.

## A) Quick Start (5 Minuten)

## A.1) Operator-Setup vor dem ersten Live-Test
- Fuer externes `build_admin`-Provisioning zuerst `docs/runbooks/OPERATOR_SETUP_CHECKLIST.md` abarbeiten.
- Erst danach `npm run verify:release` oder `EDGE_BASE_URL=... EDGE_OPERATOR_JWT=... npm run verify:release` gegen die Zielumgebung laufen lassen.

1. **Repo/Branch setzen**
   - Screen: `GitHub Repos`
   - Aktionen: Repo auswählen, Branch auswählen.
2. **Connections prüfen**
   - Screen: `Verbindungen`
   - Aktionen: GitHub/Expo Token testen und speichern.
3. **Diagnostics laufen lassen**
   - Screen: `Diagnose`
   - Aktion: `Scannen`.
4. **Fix-Loop ausführen**
   - Aktion: `Fixen` (Smart Fix) oder Issue öffnen → `Auto-Fix anwenden`.
   - Optional: `Patch Vorschau` vor Apply.
5. **Recheck**
   - Aktion: erneut `Scannen` bis Blocker weg sind.
6. **Build starten**
   - Screen: `Build`
   - Aktionen: Profil wählen → `Build starten`.

---

## B) Troubleshooting Tabelle (Symptom → Check-ID → Ursache → Fix)

| Symptom | Check-ID | Typische Ursache | AutoFix (Button/Action) | Manual Steps | Recheck |
|---|---|---|---|---|---|
| EAS projectId fehlt | `repo.easProjectId` | `extra.eas.projectId` fehlt oder EAS-Link nicht gelaufen | Issue: `Auto-Fix anwenden` oder `GitHub Repos` → `EAS Projekt erstellen/verbinden` | `eas-project.json`, `eas-link.yml` und Branch prüfen | `Diagnose` → `Scannen` |
| Workflow YAML Name mit Doppelpunkt FAIL | `workflow-yaml-name-colon-quoting` | `name: A: B` ungequotet | Issue: `Patch Vorschau` + `Auto-Fix anwenden` | Workflow-Datei manuell korrigieren, falls Patch nicht passt | `Diagnose` → `Scannen` |
| Expo Secret fehlt | `repo.secret.expoToken` | Repo Secret `EXPO_TOKEN` fehlt | `GitHub Repos` → `Secrets synchronisieren` | Secret direkt in GitHub setzen | `Diagnose` → `Scannen` |
| Verbotene Dateien gefunden | `security-forbidden-files` | Schlüsselmaterial/forbidden Artefakte im Repo | Kein AutoFix | Dateien entfernen, ggf. Key-Rotation | `Diagnose` → `Scannen` |
| Build nicht startbar (Gate) | `ERR_BRANCH_MISSING` / `ERR_DIAGNOSTIC_NOT_GREEN` | Kein Branch oder letzter Diagnostics-Status nicht grün | Kein direkter AutoFix | Branch setzen + Diagnostics vollständig grün machen | Build-Screen neu öffnen / `Scannen` erneut |

---

## C) Safety / Security
- **Forbidden Files niemals committen**: private key files, `*.jks`, `*.keystore`, sonstiges geheimes Signing-Material.
- **Secrets Policy**: Tokens/Secrets nie im Klartext in Repo-Dateien oder Logs speichern.
- **Safe-Assist-Regel**:
  - erlaubt: strukturierte AutoFixes auf klaren Config-Dateien (z. B. `eas.json`, `app.json`, `.github/workflows/*.yml`),
  - nicht erlaubt: automatische Leak-Sanierung/Rotation ohne manuelle Incident-Freigabe.

---

## D) Incident Checklist

### 1) Build hängt / Status ändert sich nicht
- Build-Screen: Job-Status + Zeitstempel prüfen.
- `Terminal` Screen auf letzte Fehler prüfen.
- GitHub Actions Run öffnen (z. B. `eas-link.yml`, `k1w1-triggered-build.yml`).
- Danach 1x kontrollierter Retry (siehe Re-run Strategy).

### 2) Workflow Dispatch 404
- Prüfen: Repo/Branch korrekt? Workflow-Datei im Ziel-Repo vorhanden?
- Aktion: `GitHub Repos` → `EAS Projekt erstellen/verbinden`.
- Danach Diagnostics Recheck.

### 3) Secrets fehlen
- In `GitHub Repos` Secrets-Sektion „Required“ prüfen.
- `Secrets synchronisieren` ausführen.
- Falls weiter FAIL: Secret in GitHub manuell setzen, dann Recheck.

### 4) EAS Link schlägt fehl
- `repo.easProjectId` + `repo.workflow.easLink` in Diagnose prüfen.
- In `GitHub Repos` EAS Link erneut triggern.
- Wenn weiter fail: Workflow-Run-Log prüfen und manuell korrigieren.


### 5) Live-Contract-Check (staging/prod, read-only)
- Vor echten Operator-Tests einmal `npm run edge:check:live` gegen die Zielumgebung ausführen.
- Erwartung:
  - `k1w1-handler` -> `400 invalid_request_payload` bei absichtlich kaputtem JSON.
  - `preview_page` -> `404 Preview not found` bei bewusst ungültigem `secret`.
- Liefert `k1w1-handler` stattdessen `401/403`, zuerst JWT / externes `build_admin`-Provisioning prüfen und **nicht** am Repo-Code herumflicken.

---

## E) Re-run Strategy (wann rerun, patch, abort)
- **Diagnostics rerun**: immer nach jedem AutoFix/Manual Fix und vor Build-Start.
- **Patch apply**: nur bei bekannten fixbaren Checks + vorher optional `Patch Vorschau`.
- **Abort statt blind retry** wenn:
  - gleicher Fehler nach 2 kontrollierten Versuchen bleibt,
  - Security-Leak/forbidden files involviert sind,
  - kein klarer Next Step aus Check-ID + Logs ableitbar ist.

---

## F) Standard Commands (lokal)
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
npm run docs:lint
```

Smoke fokussiert:
```bash
npm test -- --runInBand __tests__/e2e.smoke.buildflow.test.ts __tests__/e2e.smoke.diagnosticsResilience.test.ts __tests__/e2e.smoke.diagnosticsSchemaSnapshot.test.ts
```
