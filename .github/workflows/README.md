# GitHub Actions Workflows

Dieses Projekt verwendet optimierte GitHub Actions Workflows für CI/CD und Build-Prozesse.

## 📋 Workflow-Übersicht

| Workflow                     | Trigger               | Zweck                                   | Build-Zeit | Artifacts |
| ---------------------------- | --------------------- | --------------------------------------- | ---------- | --------- |
| **ci.yml**                  | Push/PR zu main/master | Standard CI (Lint + Typecheck + Tests) | ~5-8 min   | ❌        |
| **ci-build.yml**             | K1W1 App oder manuell | App-getriggerte CI (reusable CI Core)   | ~5-8 min   | ❌        |
| **k1w1-triggered-build.yml** | K1W1 App oder manuell | Vollständiger Build mit Status-Tracking | ~5-10 min  | ❌        |
| **release-build.yml**        | Manuell               | Production Builds mit Download          | ~10-15 min | ✅        |
| **k1w1-ci-lite.yml**         | Manuell / K1W1 App     | Read-only CI Lite (ESLint + Typecheck + Expo preflight) | ~2-5 min   | ✅        |
| **k1w1-ci-lite-autofix.yml** | Manuell / K1W1 App     | ESLint --fix + verify + optional writeback | ~3-7 min | ✅        |

---

## 🔄 ci.yml - Continuous Integration

**Trigger:** Automatisch bei Push/PR zu `main` oder `master` Branch

**Manuell:** `workflow_dispatch` verlangt ab Patch 417 ebenfalls ein explizites `ref`, damit Checkout und Concurrency denselben Ziel-Ref verwenden.

**Zweck:**

- Schnelle Validierung bei Code-Changes
- Stellt sicher, dass der Code kompiliert
- Führt Linting aus

**Optimierungen:**

- ✅ Nur Android (schneller als Multi-Platform/Web)
- ✅ `--no-wait` für schnelles Feedback
- ✅ Nutzt EAS Cache (kein `--clear-cache`)
- ✅ `npm ci` für deterministische Dependencies

**Build-Zeit:** ~5-8 Minuten

**Beispiel:**

```bash
# Automatisch bei:
git push origin main
```

---

## ✅ CI Lite (Lint + Typecheck) + Autofix

Diese beiden Workflows sind für den **APK-Builder Flow** gedacht:

- `k1w1-ci-lite.yml`: Read-only Checks (robust: fallback auf `npx eslint`/`npx tsc`, Expo-preflight auf `expo.extra.eas.projectId`, speichert Logs als Artifact)
- `k1w1-ci-lite-autofix.yml`: ESLint `--fix` + guarded commit/push auf erlaubte Branches + Verify (Lint+Typecheck+Expo preflight)

**Chain-run:** Wenn Autofix erfolgreich ist, dispatcht der Workflow automatisch einen nachfolgenden CI Lite Run (gleiches `job_id`).

**Wichtig:** CI-Lite-Chain bleibt bewusst branch-basiert, weil der nachgelagerte Read-only-CI-Lite-Workflow auf Remote-Branches arbeitet. Patch 414 härtet hier nur den manuellen Autofix-Einstieg auf explizites `ref`; die Chain-Dispatch-Ausnahme bleibt dokumentiert.

## 🚀 k1w1-triggered-build.yml - App-getriggerte Builds

**Trigger:**

1. Via Supabase Function (`SUPABASE_EDGE_FUNCTIONS.TRIGGER_EAS_BUILD`)
2. Manuell über GitHub UI (explizites `ref` ist Pflicht, kein stiller Branch-/`github.ref_name`-Fallback)

**Zweck:**

- Vollständiger EAS Build für K1W1 App
- Supabase Status-Tracking (optional)
- Unterstützt Builds mit und ohne Job ID

**Features:**

- ✅ Job ID wird von Supabase Function übergeben
- ✅ Status-Updates in Supabase `build_jobs` Tabelle
- ✅ Funktioniert auch ohne Job ID (für manuelle Triggers)
- ✅ Build URL wird extrahiert und gespeichert
- ✅ Manuelle Trigger können `autofix` und `strict_lockfile` explizit setzen
- ✅ `strict_lockfile=auto` bleibt standardmäßig profilabhängig (preview/production strikt, development flexibel)

**Build-Zeit:** ~5-10 Minuten

**Supabase Integration:**

```typescript
// K1W1 App triggert Build via Supabase Function:
const { data } = await supabase.functions.invoke(SUPABASE_EDGE_FUNCTIONS.TRIGGER_EAS_BUILD, {
  body: { githubRepo: "your-username/k1w1-a0style" },
});

// Supabase Function erstellt Job und triggert Workflow:
// 1. Create build_job → job_id
// 2. Trigger GitHub Actions with job_id
// 3. Workflow updates build_job status
```

**Manueller Trigger:**

```bash
# Via GitHub CLI:
gh workflow run k1w1-triggered-build.yml -f ref=work

# Mit Job ID:
gh workflow run k1w1-triggered-build.yml -f ref=work -f job_id=123
```

**Status Flow:**

```
queued → building → completed
   ↓         ↓          ↓
 error ←── error ←── error
```

---

## 📦 release-build.yml - Production Builds

**Trigger:** Manuell über GitHub UI

**Zweck:**

- Production-ready Builds
- Download von Build-Artifacts
- Flexible Platform/Profile-Auswahl

**Input-Parameter:**

| Parameter | Optionen                         | Default    | Beschreibung      |
| --------- | -------------------------------- | ---------- | ----------------- |
| `ref`     | Branch/Tag/SHA                   | —          | Expliziter Build-Ref |
| `profile` | production, preview, development | production | EAS Build Profile |

**Features:**

- ✅ Wartet auf Build-Completion (`--wait`)
- ✅ Download der APK/IPA Dateien
- ✅ Upload als GitHub Artifacts (30 Tage Retention)
- ✅ Build Summary in GitHub Actions

**Build-Zeit:** ~10-15 Minuten (je nach Platform)

**Manueller Trigger:**

```bash
# Via GitHub CLI:
gh workflow run release-build.yml -f ref=work -f profile=production

# Via GitHub UI:
# Actions Tab → Release Build → Run workflow → Select options
```

**Artifact Download:**

Nach erfolgreichem Build:

1. Gehe zu GitHub Actions → Release Build → Latest Run
2. Scrolle zu "Artifacts"
3. Download `k1w1-android-production.zip`
4. Entpacke die APK

---

## ✅ CI Lite Workflows (`k1w1-ci-lite*.yml`)

Diese Workflows sind für den **APK-Builder In-App Check** gedacht:

- `k1w1-ci-lite.yml`: Read-only **ESLint + Typecheck** (robust: `npm run ...` → fallback `npx`) + Logs als Artifact
- `k1w1-ci-lite-autofix.yml`: **ESLint --fix** + verify + optionaler Writeback (nur erlaubte Branches)

### Chain-Run

Wenn `k1w1-ci-lite-autofix.yml` erfolgreich endet, dispatcht er automatisch **CI Lite** auf derselben Branch.
Korrelation/Anzeige in der App läuft über dieselbe `job_id` im `run-name`.

---

## 🔐 Benötigte Secrets

Alle Workflows benötigen folgende GitHub Secrets:

| Secret                      | Beschreibung                   | Required für         |
| --------------------------- | ------------------------------ | -------------------- |
| `EXPO_TOKEN`                | EAS CLI Token                  | Alle Workflows       |
| `SUPABASE_URL`              | K1W1 Supabase URL              | k1w1-triggered-build |
| `SUPABASE_SERVICE_ROLE_KEY` | K1W1 Supabase Service Role Key | k1w1-triggered-build |

### Setup Instructions:

1. **EXPO_TOKEN:**

   ```bash
   # Login to Expo
   npx eas login

   # Generate token
   npx eas build:configure

   # Add to GitHub:
   # Settings → Secrets → Actions → New repository secret
   # Name: EXPO_TOKEN
   # Value: <your-token>
   ```

2. **SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY:**

   ```bash
   # Get from Supabase Dashboard:
   # Project Settings → API → URL
   # Project Settings → API → service_role key (secret!)

   # Add to GitHub:
   # Settings → Secrets → Actions → New repository secret
   ```

---

## 🐛 Troubleshooting

### Build schlägt fehl

**Symptom:** Workflow zeigt Fehler in "Build on EAS" Step

**Lösungen:**

1. Prüfe EAS CLI Token:
   ```bash
   npx eas whoami
   ```
2. Prüfe `eas.json` Konfiguration
3. Prüfe expo.dev Build-Logs:
   ```bash
   npx eas build:list
   npx eas build:view <build-id>
   ```

### Job ID fehlt (k1w1-triggered-build)

**Symptom:** Workflow läuft, aber "Validate Job ID" zeigt Warning

**Ursachen:**

- Manueller Trigger ohne Job ID (OK)
- Supabase Function sendet keine Job ID (BUG - sollte gefixt sein!)

**Prüfen:**

```bash
# Supabase Function Logs:
supabase functions logs <edge-function-name>  # z.B. trigger-eas-build

# GitHub Actions Payload:
# Actions → Workflow Run → View workflow file → Check client_payload
```

### Build ist zu langsam

**Symptom:** Build dauert > 20 Minuten

**Optimierungen:**

1. Verwende `--no-wait` für CI (ci-build.yml)
2. Entferne `--clear-cache` wenn nicht nötig
3. Baue nur eine Platform (nur android)
4. Prüfe EAS Build-Queue Status:
   ```bash
   npx eas build:list --status=in-queue
   ```

### Dependencies sind veraltet

**Symptom:** `npm ci` schlägt fehl

**Lösung:**

```bash
# Lokal dependencies aktualisieren:
npm install
npm audit fix

# Commit package-lock.json
git add package-lock.json
git commit -m "Update dependencies"
git push
```

---

## 📊 Performance-Optimierungen

### Vor Optimierung (alte Workflows):

```
build.yml:
  - Platform: multi-platform (z.B. android + web)
  - Clear Cache: ja
  - npm: install
  - Node: 18
  ⏱️ Build-Zeit: 15-25 Minuten
```

### Nach Optimierung (neue Workflows):

```
ci-build.yml:
  - Platform: android only
  - Clear Cache: nein
  - npm: ci
  - Node: 20
  ⏱️ Build-Zeit: 5-8 Minuten
```

**Verbesserung:** 🚀 **60-70% schneller!**

### Optimierungs-Details:

| Optimierung                         | Zeitersparnis | Warum?                                         |
| ----------------------------------- | ------------- | ---------------------------------------------- |
| `--no-wait` statt `--wait`          | ~5-10 min     | Workflow wartet nicht auf EAS Build Completion |
| Android only statt Multi-Platform   | ~10-15 min    | Multi-Platform Builds dauern deutlich länger     |
| `npm ci` statt `npm install`        | ~1-2 min      | Deterministisch, kein dependency resolution    |
| Node 20 statt 18                    | ~30 sec       | Bessere Performance, neuere V8 Engine          |
| Cache nutzen (kein `--clear-cache`) | ~2-5 min      | Dependencies werden gecacht                    |

---

## 🔄 Workflow-Migration

### Alte Workflows → Neue Workflows

| Alt                             | Neu                           | Grund                      |
| ------------------------------- | ----------------------------- | -------------------------- |
| `build.yml`                     | ✅ `ci-build.yml`             | Optimiert für schnelle CI  |
| `deploy-supabase-functions.yml` | ✅ `k1w1-triggered-build.yml` | Korrekter Name + Bug-Fixes |
| `eas-build.yml`                 | ✅ Aktiv                      | Reusable EAS build + stricter lockfile policy |

### Breaking Changes:

**Keine!** Die neuen Workflows sind rückwärtskompatibel:

- ✅ Supabase Function Integration funktioniert weiterhin
- ✅ GitHub Secrets bleiben gleich
- ✅ EAS Build Konfiguration unverändert

---


### EAS Build lockfile policy

- `development`: darf weiter ohne Lockfile per `npm install` ausweichen (nicht reproduzierbar, aber hilfreich für Autofix/Bootstrap).
- `preview` und `production`: verlangen jetzt ein vorhandenes `package-lock.json` oder `npm-shrinkwrap.json`. Ohne Lockfile bricht der Workflow bewusst mit Fehler ab.

### Deploy Supabase (Edge Functions)

Der Workflow `deploy-supabase-functions.yml` bleibt bewusst **gepinned** und nutzt weiter `supabase login` + `supabase link`.

Manuelle Eingaben bei `workflow_dispatch`:

- `ref`: Branch/Ref zum Deployen
- `deploy_all`: `true` deployt alle Functions außer `_shared` und `test` (legacy disabled)
- `function_name`: deployed genau **eine** Function, wenn `deploy_all=false`

Guardrails:

- `_shared` wird nie deployed
- `function_name` muss auf ein echtes Verzeichnis unter `supabase/functions/<name>` zeigen
- der bisherige `deploy_all=true`-Pfad bleibt unverändert

---

## 📚 Weitere Ressourcen

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [expo-github-action](https://github.com/expo/expo-github-action)

---

## 🆘 Support

**Fragen?** Öffne ein GitHub Issue oder kontaktiere das Team.

**Build-Logs:** Alle Logs sind verfügbar unter:

- GitHub Actions: `https://github.com/<username>/k1w1-a0style/actions`
- EAS Build: `https://expo.dev/accounts/<username>/projects/k1w1-a0style/builds`
- Supabase Logs: Supabase Dashboard → Edge Functions → Logs

---

**Letzte Aktualisierung:** 5. Dezember 2025  
**Version:** 2.0 (Optimiert)

- `eas-build.yml`: production keystore export now writes sanitized diagnostics artifacts and always cleans up temporary signing files.


## CI Lite chain-run dispatch

`k1w1-ci-lite-autofix.yml` chains into `k1w1-ci-lite.yml` via `repository_dispatch` (`event_type=trigger-ci-lite`). `k1w1-ci-lite.yml` records `workflow_ref`, `workflow_sha`, trigger mode and source workflow metadata in `ci-lite-result.json` to make default-branch workflow provenance visible during debugging.

## Patch 397
- CI Lite / Autofix now capture lightweight workflow metadata (`metadata.env`, Node version, npm version) and include run id + attempt in artifact names.
- Supabase deploy now writes a small deploy metadata artifact plus a summary block for manual/manual-like runs.
- Patch 395 dispatch architecture remains unchanged: `k1w1-ci-lite.yml` keeps `repository_dispatch`, `k1w1-ci-lite-autofix.yml` stays `workflow_dispatch` and dispatches CI Lite via repository dispatch.

## Workflow ↔ Edge Contract Guard

Zusätzlich zu den Drift-Guards gibt es `scripts/check_workflow_edge_contracts.sh` sowie ab Patch 416 `scripts/check_legacy_disabled_edges.sh`.

Der Check stellt sicher, dass die operativen Verträge zwischen Workflows und Edge-Functions nicht still brechen, insbesondere:

- `trigger-eas-build` dispatcht `event_type=trigger-eas-build` mit `job_id`, `branch/ref` und Profilfeldern
- `k1w1-triggered-build.yml` reicht `job_id`, `autofix` und `strict_lockfile` an `eas-build.yml` weiter
- `eas-build.yml` schreibt `source_commit_sha` und nutzt `android-keystore-export`
- `check-eas-build` liefert `urls`, `source_commit_sha` und optionale Artifact-Metadaten
- `github-run-artifact-json` liefert `text`, `json`, `artifactId`, `artifactName` und `filePath`
- `github-workflow-logs` liefert `logsText`

Zusätzlich führt `workflow-lint.yml` diese Guards jetzt ebenfalls in CI aus.

Die Trigger-Pfade von `workflow-lint.yml` decken ab Patch 406 außerdem die neuen Guard-Skripte, `docs/WORKFLOW_PATCHING.md` sowie die zugehörige Patch-/Edge-Doku ab; doppelte Path-Einträge wurden entfernt und `actionlint` ist dort versionsgepinnt, inklusive versionsgebundenem Installer-Script.
Ab Patch 417 decken die Trigger-Pfade zusätzlich die eingebetteten Workflow-Template-Quellen `lib/diagnostics/workflowTemplates.ts` und `templates/expo-sdk54-base.json` ab, damit Ref-SoT-Änderungen dort nicht an `workflow-lint` vorbeidrücken.

## deploy-supabase-functions.yml

- Trigger: nur `workflow_dispatch`
- `ref` ist Pflicht und bestimmt explizit den auszucheckenden Stand
- `apply_migrations` steuert, ob `supabase db push` nie / immer / nur bei erkannten Migrationsänderungen läuft
- Single-Function-Deploys blocken `_shared` und validieren `function_name`

Patch 415 V3 zieht die workflow-/CI-nahen Edge-Auth-Pfade auf einen gemeinsamen Admin-Key/CI-Bearer-Guard; Wizard-/Keystore-Setup-Routen bleiben absichtlich admin-only.
Patch 416 deaktiviert die absichtlich stillgelegten Legacy-Lint-/Native-Sync-Edges auch in `supabase/config.toml`; ihre 410-Stubs bleiben als explizite Legacy-Failsafes erhalten und werden per Guard-Script mitgeprüft.
