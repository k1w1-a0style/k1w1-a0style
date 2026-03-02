# App Runbook (QA / Operator)

Stand: 2026-03-02

Ziel: In <30 Minuten reproduzierbar von „frisches Setup“ zu „Build gestartet“ kommen — inkl. klarer Fehlerpfade.

## A) Quick Start (5 Minuten)
1. **Repo + Branch setzen**
   - Screen: `GitHub Repos`
   - Aktionen: Repo auswählen, Branch auswählen.
2. **Tokens/Connections prüfen**
   - Screen: `Verbindungen`
   - GitHub + Expo Token setzen/testen.
3. **Diagnostics starten**
   - Screen: `Diagnose`
   - Aktion: `Run diagnostics`.
4. **AutoFix anwenden**
   - Aktion: `Smart Fix` oder pro Issue `Auto-Fix anwenden`.
5. **Recheck**
   - Aktion: erneut `Run diagnostics` bis keine Blocker mehr offen sind.
6. **Build starten**
   - Screen: `Build`
   - Profil wählen, dann `Start Build`.

---

## B) Troubleshooting Map (Symptom → Cause → Fix → Recheck)

| Symptom | Typische Ursache | Fix | Recheck |
|---|---|---|---|
| `repo.easProjectId` = FAIL | `extra.eas.projectId` fehlt | Issue-Detail: AutoFix (EAS link) anwenden | Diagnostics erneut laufen lassen |
| `workflow-yaml-name-colon-quoting` = FAIL | YAML `name: A: B` nicht gequotet | AutoFix anwenden (Workflow-Datei patchen) | Diagnostics erneut laufen lassen |
| `repo.secret.expoToken` = FAIL | Secret `EXPO_TOKEN` fehlt im Repo | `Secrets synchronisieren` in GitHub Repos oder manuell in GitHub setzen | Pipeline diagnostics erneut |
| `security-forbidden-files` = FAIL | Verbotene Dateien (z. B. private keys) im Projekt | Dateien entfernen + ggf. Key-Rotation | Diagnostics erneut |
| Build button disabled (`Nicht bereit`) | Branch fehlt oder `diagnostic_last_ok != true` | Repo/Branch neu setzen + Diagnostics grün machen | Build-Screen erneut öffnen/refresh |

---

## C) Safety & Security

### Niemals ins Repo committen
- Private Keystores / Schlüsselmaterial (`*.jks`, `*.keystore`, private key files)
- Service Role Schlüssel im Klartext
- Tokens/Secrets in Workflow- oder App-Dateien

### Safe Assist Policy
- **Auto-replace erlaubt**, wenn der Patch auf klar definierte Konfigurationsdateien abzielt (`eas.json`, `app.json`, `.github/workflows/*.yml`) und im Issue als AutoFix angeboten wird.
- **Nicht automatisch ersetzen**, wenn Sicherheitsvorfall/Leak-Rotation nötig ist (Manual Incident Handling).
- Vor Apply bei sensiblen Änderungen zuerst `Patch Vorschau` öffnen.

---

## D) Incident Checklist

### Build hängt / „stuck“
1. Build-Screen Status prüfen (aktueller Job + Zeitstempel).
2. GitHub Actions Run prüfen (`eas-link.yml` / `k1w1-triggered-build.yml`).
3. Bei Timeout/fehlender Aktualisierung:
   - einmal neu triggern,
   - vorher Diagnostics kurz re-run.

### Logs & Quellen
- In-App: `Terminal` Screen (aggregierte Logs)
- Build-Status: `EnhancedBuildScreen`
- Remote Details: GitHub Actions + EAS Dashboard

### Retry Policy (pragmatisch)
- **1x sofortiger Retry** bei transientem Netzwerk-/API-Fehler.
- **2. Versuch nach Recheck** (Diagnostics + Secrets/Branch prüfen).
- Danach Incident als „manual investigation“ markieren (kein blindes Dauerklicken).

---

## E) Buildflow E2E (Diagnostics → AutoFix → Recheck)
1. `GitHub Repos`: Repo/Branch setzen.
2. `Diagnose`: Run.
3. Fix-Lauf (`Smart Fix` oder einzeln).
4. Re-Run Diagnostics.
5. `Build`: Profil wählen, Start.
6. `Status/History`: Verlauf prüfen.

---

## F) Standard Commands (lokal)
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
npm run docs:lint
```

Nur Smoke:
```bash
npm test -- --runInBand __tests__/e2e.smoke.buildflow.test.ts __tests__/e2e.smoke.diagnosticsResilience.test.ts __tests__/e2e.smoke.diagnosticsSchemaSnapshot.test.ts
```
