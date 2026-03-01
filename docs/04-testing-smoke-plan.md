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

