# RELEASE READINESS BEFUND (Codex)

Stand: **2026-04-25**
Scope: Lokaler Readiness-Review ohne grossen Refactor, mit vollständigem Checklauf.

## 1) Ampelstatus

**Gesamtstatus: GELB**

Begründung:
- Alle lokalen Code-/Qualitätschecks sind grün (`typecheck`, `typecheck:edge`, `lint:ci`, `test:silent`).
- `verify:release` endet korrekt mit **`OK_WITH_SKIPS`** statt `OK_FULL`, da Live-Edge-ENV fehlt.
- Damit ist der Stand lokal sehr stabil, aber **nicht als vollständiger Live-Release-Sign-off** belastbar.

## 2) Ausgeführte Checks (Ist-Ergebnis)

| Check | Ergebnis |
|---|---|
| `npm ci` | ✅ erfolgreich (mit bekannten npm Warnungen) |
| `npm run typecheck` | ✅ grün |
| `npm run typecheck:edge` | ✅ grün |
| `npm run lint:ci` | ✅ grün |
| `npm run test:silent` | ✅ grün (478/478 Suites, 2145/2145 Tests) |
| `npm run verify:release` | ⚠️ **OK_WITH_SKIPS** (Live-Checks geskippt) |
| `npm run edge:check:live` | ⏭️ nicht ausgeführt (ENV nicht gesetzt) |

## 3) Konkrete Fehler-/Risikopunkte

### Befund A — Live-Release-Evidenz unvollständig (kein Codefehler, aber Release-Blocker für „Vollfreigabe“)
- **Fundstelle/Signal**:
  - `scripts/check_release_readiness.sh` skippt Live-Contracts ohne `EDGE_BASE_URL` + `EDGE_OPERATOR_JWT`.
  - Lokaler Lauf meldet: `OK_WITH_SKIPS` und „partial/local evidence only“. 
- **Vermutete Ursache**:
  - Erwartbar im lokalen Umfeld: erforderliche Live-Variablen sind absichtlich nicht gesetzt.
- **Empfohlener Fix**:
  - Für finalen Release-Sign-off in CI/Operator-Umgebung mit Masked Secrets laufen lassen:
    - `EDGE_BASE_URL`
    - `EDGE_OPERATOR_JWT`
    - optional für JWT-Preflight: `SUPABASE_SERVICE_ROLE_KEY`
  - Danach `npm run verify:release` erneut; Zielstatus: **`OK_FULL`**.

### Befund B — npm Environment-Warnung (`http-proxy`) (Umgebungs-Noise)
- **Fundstelle/Signal**:
  - Wiederkehrende Warnung: `npm warn Unknown env config "http-proxy"`.
- **Vermutete Ursache**:
  - NPM-Client/Runner-Umgebung enthält Legacy-Proxy-Config-Key.
- **Empfohlener Fix**:
  - In CI/Runner die npm Config auf aktuelle Proxy-Keys bereinigen (kein Repo-Code-Fix notwendig).

## 4) Analyse: Tests, TS, Lint

- **Fehlschlagende Tests**: keine.
- **TypeScript-Fehler**: keine.
- **Lint-Fehler**: keine.

Fazit: Der Code- und Testzustand ist lokal reproduzierbar grün.

## 5) Analyse: ENV-Gates / Widersprüche

### Live-Edge Gate-Logik
- `check_edge_live_env_readiness.sh` ist fail-safe/fail-closed aufgebaut:
  - ohne `EDGE_BASE_URL` → SKIP,
  - mit ungültiger URL → FAIL,
  - ohne brauchbaren JWT → SKIP,
  - mit `SUPABASE_SERVICE_ROLE_KEY` zusätzlich JWT-Preflight gegen Supabase Auth.
- `check_edge_live_contracts.sh` erzwingt bewusst JWT-only Operator-Contract (kein Service-Role-Fallback für interaktive Route).

**Bewertung:** Gate-Logik ist konsistent und sicher; aktuell kein Widerspruch gefunden.

## 6) Analyse: Preview-/Supabase-/GitHub-/EAS-Flows

### Preview-Flow
- Live-Contract-Script prüft:
  - `preview_page` ohne Secret-Header → 400,
  - `save_preview` mit JWT + Payload → 200 mit `previewUrl` via Fragment-Secret (`#secret=`), kein Query-Secret (`?secret=`).
- Das entspricht dem dokumentierten fail-closed Preview-Vertrag.

### Supabase-Flow
- `check_supabase_deploy_workflow.sh` erzwingt manuelle, gehärtete Dispatch- und Input-Sanitization-Verträge für Deploy-Workflow.
- Kein Auto-Deploy auf `push`, Validierung für Ref-/Function-Inputs vorhanden.

### GitHub-Workflow-/Edge-Contracts
- `check_workflow_edge_contracts.sh` validiert umfassend RBAC/JWT-/Scoped-Contracts sowie verbotene Legacy-Pfade.
- Lauf im `verify:release` war grün.

### EAS-Flow
- `check_eas_production_credentials.sh` prüft Presence kritischer Produktions-Credential-Preflight-Schritte im Workflow.
- Lauf im `verify:release` war grün.

**Bewertung gesamt:** Vertrags- und Workflow-Flows sind im Repo-Stand konsistent; aktuell keine harte Inkonsistenz sichtbar.

## 7) Analyse: Android Backup-Konfiguration

### Manifest
- `android:allowBackup="true"` ist gesetzt.
- Gleichzeitig sind sowohl `android:fullBackupContent` als auch `android:dataExtractionRules` gesetzt.

### Backup-Regeln
- `secure_store_backup_rules.xml` und `secure_store_data_extraction_rules.xml` schließen Daten fail-closed aus (`root` und explizit `sharedpref/SecureStore`).

**Bewertung:** Trotz `allowBackup=true` ist die effektive Datensicherung durch explizite Excludes auf „keine App-Daten in Backup/Transfer“ gehärtet. Der Vertrag ist konsistent und sicher dokumentiert.

## 8) Welche Checks sind grün/rot?

- **Grün:**
  - `npm ci`
  - `npm run typecheck`
  - `npm run typecheck:edge`
  - `npm run lint:ci`
  - `npm run test:silent`
- **Gelb (teilweise Evidenz):**
  - `npm run verify:release` → `OK_WITH_SKIPS`
- **Rot:**
  - Keine roten lokalen Checks.

## 9) Kurzfazit (Release-Readiness)

- **Code-Qualität lokal:** stabil grün.
- **Operative Vollfreigabe:** noch **nicht vollständig**, bis Live-ENV-gebundene Contracts in einer sicheren CI/Operator-Umgebung gelaufen sind.
- **Empfehlung:** nächster enger Block = „Live-Contract-Lauf mit gesetzten ENV in gesicherter Umgebung + Evidenzablage“.
