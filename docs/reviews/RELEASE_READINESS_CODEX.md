# RELEASE READINESS BEFUND (Codex)

Stand: **2026-04-25**  
Scope: Lokaler Readiness-Review ohne große Codeänderungen / ohne Secrets.

---

## 1) Ampelstatus

**Gesamtstatus: GELB**

**Warum GELB (nicht ROT/GRÜN):**
1. Alle lokalen Qualitätschecks sind grün.
2. `verify:release` liefert lokal korrekt **`OK_WITH_SKIPS`** (nicht `OK_FULL`), weil Live-ENV für Edge-Contract-Checks nicht gesetzt ist.
3. Damit ist der Stand lokal belastbar, aber nicht als vollständiger Live-Release-Sign-off abgeschlossen.

---

## 2) Check-Ergebnisse (ausgeführt)

| Check | Ergebnis | Kurzbefund |
|---|---|---|
| `npm ci` | ✅ | erfolgreich (mit bekannter npm-Umgebungswarnung) |
| `npm run typecheck` | ✅ | grün |
| `npm run typecheck:edge` | ✅ | grün |
| `npm run lint:ci` | ✅ | grün |
| `npm run test:silent` | ✅ | grün (478/478 Suites, 2145/2145 Tests) |
| `npm run verify:release` | ⚠️ | erfolgreich mit `OK_WITH_SKIPS` |
| `npm run edge:check:live` | ⏭️ | nicht ausgeführt (ENV nicht gesetzt) |

---

## 3) Konkrete Fehler/Risiken mit Datei/Pfad, Ursache, Fix

### Befund A — Live-Release-Evidenz unvollständig (Release-Sign-off-Blocker)
- **Kategorie:** GELB
- **Fundstelle (Datei/Pfad):**
  - `scripts/check_release_readiness.sh` (Live-Contracts werden ohne `EDGE_BASE_URL` + `EDGE_OPERATOR_JWT` geskippt; Ergebnis `OK_WITH_SKIPS`).
  - `scripts/check_edge_live_env_readiness.sh` (SKIP/FAIL-Logik je ENV-Status).
- **Symptom:** lokale Readiness ist nur teilweise evidenzbasiert (partial/local evidence).
- **Vermutete Ursache:** erforderliche Live-ENV im lokalen Lauf absichtlich nicht gesetzt.
- **Empfohlener Fix:** Live-Run in sicherer CI/Operator-Umgebung mit masked secrets:
  - `EDGE_BASE_URL`
  - `EDGE_OPERATOR_JWT`
  - optional zusätzlich `SUPABASE_SERVICE_ROLE_KEY` für JWT-Preflight
  - danach `npm run verify:release` erneut; Ziel: `OK_FULL`.

### Befund B — npm Proxy-Warnung (Umgebungs-Noise)
- **Kategorie:** GELB (niedrige Priorität)
- **Fundstelle (Datei/Pfad):** Laufzeitwarnung aus npm (`Unknown env config "http-proxy"`).
- **Symptom:** wiederkehrende Warnung bei npm-Kommandos.
- **Vermutete Ursache:** Legacy-Proxy-Key in Runner-/Shell-Config.
- **Empfohlener Fix:** npm-Umgebung im Runner bereinigen (kein Repo-Code-Refactor erforderlich).

### Befund C — Harte Codefehler in Tests/TypeScript/Lint
- **Kategorie:** GRÜN
- **Fundstelle (Datei/Pfad):** n/a (keine fehlschlagenden Checks in diesem Lauf).
- **Symptom:** keines.
- **Vermutete Ursache:** n/a.
- **Empfohlener Fix:** keiner nötig.

---

## 4) Analyse: fehlende/widersprüchliche ENV-Gates

### Ergebnis
**Kein Widerspruch gefunden**, Gate-Verhalten ist konsistent:
- `verify:release` führt lokale Repo-Checks vollständig aus und behandelt Live-Checks sauber als ENV-gated.
- `check_edge_live_env_readiness.sh` ist fail-safe/fail-closed (SKIP bei fehlender ENV, FAIL bei ungültiger Form).
- `check_edge_live_contracts.sh` erzwingt JWT-basierten Operator-Vertrag; Service-Role-Fallback ist bewusst deaktiviert.

---

## 5) Analyse: Preview / Supabase / GitHub / EAS Flows

### Preview
- Live-Contract-Script prüft:
  - `preview_page` ohne Secret-Header => 400,
  - `save_preview` mit JWT + Minimalpayload => 200 (`ok:true`, `#secret=`, kein `?secret=`).
- Bewertung: fail-closed und konsistent.

### Supabase Deploy Flow
- Workflow ist manuell (`workflow_dispatch`) und enthält gehärtete Input-Sanitization (`git check-ref-format`, function-name Regex, reserved-path guard, migrations policy).
- Bewertung: konsistenter, kontrollierter Deploy-Flow; kein Auto-Deploy auf push.

### GitHub/Edge Contract Flow
- `verify:release` bindet den Contract-Check (`check_workflow_edge_contracts.sh`) ein.
- Bewertung: kein lokaler Drift sichtbar.

### EAS Flow
- `eas-build.yml` enthält strict lockfile policy controls (`auto|true|false`) mit fail-closed Verhalten in preview/production.
- `check_eas_manual_trigger_controls.sh` und `check_eas_production_credentials.sh` liefen im verify-Block grün.
- Bewertung: Workflow- und Credential-Guards vorhanden.

---

## 6) Analyse: Android Backup-Konfiguration

### Ist-Zustand
- `AndroidManifest.xml` enthält:
  - `android:allowBackup="true"`
  - `android:fullBackupContent="@xml/secure_store_backup_rules"`
  - `android:dataExtractionRules="@xml/secure_store_data_extraction_rules"`
- Backup-Regeln schließen App-Daten fail-closed aus (`root` + `sharedpref/SecureStore`) sowohl für Cloud-Backup als auch Device-Transfer.

### Bewertung
Kein Widerspruch im aktuellen Vertrag: trotz `allowBackup=true` wird die effektive Datensicherung durch explizite Excludes stark eingeschränkt.

---

## 7) Was ist grün/gelb/rot?

### Grün
- `npm ci`
- `npm run typecheck`
- `npm run typecheck:edge`
- `npm run lint:ci`
- `npm run test:silent`

### Gelb
- `npm run verify:release` => `OK_WITH_SKIPS` (partial evidence)
- npm-Umgebungswarnung `http-proxy`

### Rot
- Keine roten lokalen Checks.

---

## 8) Kurzfazit / nächste Aktion

- **Lokaler Code-/Checkzustand:** stabil grün.
- **Vollständige Release-Freigabe:** noch offen, bis Live-Edge-Contracts mit gesetzten ENV in einer sicheren Umgebung gelaufen sind.
- **Nächster enger Block:** „Live-ENV setzen (masked), `verify:release` auf `OK_FULL` schließen, Evidence dokumentieren“.
