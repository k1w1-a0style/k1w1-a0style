# 04 — Testing & Smoke Plan (Buildflow + Diagnostics)

Stand: 2026-03-01

Dieses Smoke-Plan fokussiert auf **Build Startbarkeit** (Gate) und **Diagnostics/Fix-Loops**.

> Definition “grün”:  
> - Build Readiness Gate erfüllt (docs/06)  
> - Diagnostics sind ausführbar, reproduzierbar und liefern konsistente Fix-Patches  
> - Pipeline Checks schlagen nicht wegen fehlender Mocks/Permissions in Tests fehl

---

## 1) Schnell-Smoke (lokal, < 5 Minuten)

### 1.1 Jest / Typecheck / Lint (Fast)
```bash
npm run preflight:fast
```

### 1.2 Full preflight (inkl. Tests)
```bash
npm run preflight
```

Erwartung:
- `typecheck` ok
- `lint:ci` ok
- `jest --silent` ok
- `audit:types` ok
- `audit:imports` ok

---

### 1.3 Docs-Lint (Doku-Konsistenz)
```bash
npm run docs:lint
```

Erwartung:
- Links in `docs/INDEX.md` zeigen auf existierende Dateien
- Patch-Referenzen in `docs/patches/PATCHLOG_ROOT.md` sind gültig
- Check-IDs aus `docs/07-diagnostics-fix-playbook.md` sind in `lib/diagnostics` auffindbar

---

## 2) Diagnostics Smoke (In-App)

### 2.1 Local checks
1. App starten → Projekt laden / anlegen  
2. Diagnostics Screen → **Scannen**  
3. Erwartung:  
   - Keine Crashes (ein crashing check darf nicht die gesamte run abbrechen)  
   - Fail/Warn/Pass Sortierung: fail zuerst

### 2.2 AutoFix loop (min. 2 typische Fälle)
- Case A: Entry-Point fehlt → AutoFix erzeugt `index.js` + setzt `package.json.main`
- Case B: Workflow YAML name quoting → AutoFix quotet `name: "A: B"`

Nach jedem Fix:
- Erneut **Scannen** → der gefixte Check muss “pass” oder “warn → pass” werden.

---

## 3) Pipeline Diagnostics Smoke (GitHub)

> Voraussetzung: Repo verknüpft + gültiger Branch

1. Diagnostics Screen → Scannen (Pipeline aktiviert)
2. Erwartung:
   - `local.githubToken`/`local.expoToken` reagieren korrekt auf fehlende Tokens
   - `repo.secret.expoToken` fail wenn Secret fehlt
   - `repo.workflow.*` fail wenn Workflow fehlt

---

## 4) Build Readiness Gate Smoke (Service)

### 4.1 Hard-Blocker müssen wirklich blocken
- Repo fehlt/ungültig
- Branch fehlt
- Tokens fehlen
- Diagnostics nicht grün (`DIAGNOSTIC_LAST_OK != "true"`)
- Signing fehlt (profilbezogen)
- Prod: Supabase Secrets fehlen

Erwartung:
- Build start wird **abgebrochen bevor** Git push / Workflow dispatch / Supabase invoke passiert.

### 4.2 Negative test: Keine stillen Defaults
- branch darf **nicht** automatisch auf defaultBranch/main fallen, wenn linkedBranch leer ist.
- repo darf **nicht** auf CONFIG default fallen, wenn linkedRepo leer ist.

---

## 5) CI Smoke (minimal)

- `npm ci` / `npm test` läuft in CI
- `eas-prebuild` ruft `npm run preflight` (sollte schnell failen, wenn gating regressiert)

---

## 6) Regression Focus Areas

- Patch Apply Engine (jsonMerge/upsert/delete)
- Workflow Templates (YAML quoting, no leaked secrets)
- Secret names / Storage keys / Profile names (Invariant String Tests)

Siehe `docs/08-test-coverage-matrix.md` für konkrete neue Tests.


---

## 7) E2E Smoke (Fixtures, lokal & reproduzierbar)

Fixture-Root: `test/fixtures/smokeRepos/`

Vorhandene Fixtures:
- `missing-all-minimum` → leerer Repo-Zustand (kein `eas.json`, kein Expo Config, keine Workflows)
- `missing-easProfiles` → `eas.json` vorhanden, aber `build.preview` fehlt
- `workflow-colon-quoting` → Workflow enthält unquoted `name: Foo: Bar`
- `secrets-missing` → valide Dateien, aber Pipeline-Secretliste wird als leer simuliert

E2E Smoke Tests:
- `__tests__/e2e.smoke.buildflow.test.ts`
- `__tests__/e2e.smoke.diagnosticsResilience.test.ts`
- `__tests__/e2e.smoke.diagnosticsSchemaSnapshot.test.ts`

PASS-Kriterien:
- AutoFix erzeugt fehlendes `app.json` / `eas.json` und ergänzt canonical EAS Profile.
- Workflow Quoting Fix ersetzt kritische `name: A: B` Werte durch quoted Strings.
- Re-Scan nach Fixes enthält keine unerwarteten `fail` für den lokalen Green Path.
- Secrets-Missing bleibt deterministisch als erwarteter `fail` (`repo.secret.expoToken`).

FAIL-Kriterien:
- Runner crasht bei geworfenen Check-Fehlern.
- Patches werden nicht angewendet oder überschreiben fremde Keys destruktiv.
- Snapshot-Schema driftet in `id/status/severity` ohne beabsichtigte Änderung.

---

## 8) Phase 8: Real-world CI/EAS Smoke

Ziel: GitHub Actions + EAS in **Safe Mode** verifizieren, ohne versehentlichen Production-Deploy.

### A1) Workflow YAML Validierung (lokal)
1. Prüfe alle `.github/workflows/*.yml` auf YAML-Parsebarkeit.
2. Prüfe `name:`-Felder mit `:` auf korrektes Quoting.
3. Prüfe `workflow_dispatch` für die dispatchbaren Build-Workflows (`eas-link.yml`, `k1w1-triggered-build.yml`, `eas-build.yml`, `release-build.yml`).

Beispielcheck:

```bash
for f in .github/workflows/*.yml; do
  ruby -e 'require "yaml"; YAML.load_file(ARGV[0]); puts "OK"' "$f"
done
```

### A2) Secrets Sanity (Existenz, keine Werte)
Pflicht:
- `EXPO_TOKEN`

Optional (abhängig von Guarding/Flow):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Report nur als `yes/no`, niemals Secret-Werte loggen.

### A3) Dry Dispatch: `eas-link.yml`
1. `workflow_dispatch` auf der Ziel-Branch (z. B. `codex`) auslösen.
2. Verifizieren, dass Run mindestens `queued`/`in_progress` erreicht.
3. Abschluss erfassen: `success` oder erwartbarer Fehler (z. B. Permissions).

Output:
- `run_id`
- `run_url`
- `conclusion`
- bei Fail: kurzer Error-Excerpt ohne Secrets.

### A4) projectId Verifikation nach Link
Nach erfolgreichem EAS-Link:
- `eas-project.json` vorhanden
- `projectId` gesetzt

Output:
- `projectId exists: yes/no`
- `file: eas-project.json`

### B1) Optional: Triggered Preview Build (kleinster echter Build)
1. Workflow `k1w1-triggered-build.yml` dispatchen.
2. Inputs: `profile=preview` (oder `development`), `platform=android`.
3. Erwartung: Build startet mindestens bis Queueing/Submission-Step.
4. Optional: nach Queueing abbrechen (Kostenkontrolle).

Output:
- `run_id`
- `run_url`
- `status/conclusion`
- ggf. EAS Build-ID/URL aus Log.

### Exit Criteria (Phase 8)
- Workflow dispatch funktioniert (kein 404/permission dead-end).
- EAS Link schreibt valide `projectId`.
- Triggered Build startet mindestens bis `queued`.
- Keine Production-Dispatches im Smoke-Lauf.
