# 11 — Issue Pack (GitHub copy/paste ready)

Stand: 2026-03-02

## Quick Triage
- **Sprint 1 (P0):** #1, #2, #3, #4
- **Sprint 2 (P1):** #5
- **Backlog (P2):** #6

---

## 1) EAS Project ID AutoFix (One-click link)
**Title:** P0: `repo.easProjectId` FAIL braucht One-click AutoFix via `eas-link.yml`  
**Priority:** P0  
**Labels:** `prio:P0`, `type:enhancement`, `area:eas`, `area:diagnostics`, `area:build-gate`

**Problem**
`repo.easProjectId` ist Blocker, aber bisher ohne robusten One-click Fix-Flow.

**Steps to reproduce**
1. Repo ohne `eas-project.json` und ohne `expo.extra.eas.projectId` scannen.
2. `repo.easProjectId` wird FAIL.
3. Kein verlässlicher One-click Weg zur Verknüpfung.

**Acceptance criteria**
- FAIL-Check `repo.easProjectId` hat Fix Action „EAS Projekt verbinden (Auto)“.
- Fix triggert `eas-link.yml` via Workflow Dispatch.
- Falls Workflow fehlt: Fallback bootstrap/CI-Autofix möglich.
- Nach Re-Scan wird `repo.easProjectId` PASS (wenn projectId geschrieben wurde).

**Test Plan**
- Unit: pipeline diagnostics liefert bei FAIL eine `workflowDispatch` Fix-Metadatenstruktur.
- Integration-light: UI Fix Runner ruft Dispatcher mit `eas-link.yml`.

**Rollout notes / risk**
- Risiko: Workflow nicht vorhanden / keine Dispatch-Rechte.
- Mit klarer Fehlermeldung und Retry/Bootstrap entschärfen.

---

## 2) Canonical EAS Config AutoFix
**Title:** P0: `repo.easJson` und `repo.easProfile.*` als One-click „Apply canonical EAS config"  
**Priority:** P0  
**Labels:** `prio:P0`, `type:enhancement`, `area:eas`, `area:diagnostics`, `area:patch-engine`

**Problem**
Fehlendes/inkonsistentes `eas.json` blockiert Buildflow häufig.

**Steps to reproduce**
1. Repo ohne `eas.json` oder ohne `build.preview` scannen.
2. `repo.easJson`/`repo.easProfile.*` werden FAIL.

**Acceptance criteria**
- Bei `repo.easJson` FAIL: upsert komplette canonical `eas.json`.
- Bei `repo.easProfile.*` FAIL: additive `jsonMerge` ergänzt fehlende Profile.
- Canonical enthält `development|preview|production`, `android.buildType="apk"`,
  `withoutCredentials=true` für dev/preview und `false` für production.
- Additive Merge überschreibt keine fremden Sibling-Keys.

**Test Plan**
- Unit: missing `eas.json` => FAIL + upsert fix.
- Unit: missing `build.preview` => FAIL + jsonMerge fix.
- Patch-engine Test: custom keys bleiben bei Merge erhalten.

**Rollout notes / risk**
- Risiko gering (additiver Merge, deterministisch).

---

## 3) Minimal Expo Config AutoFix
**Title:** P0: `expo-config-validation` FAIL -> „Create minimal app.json"  
**Priority:** P0  
**Labels:** `prio:P0`, `type:enhancement`, `area:diagnostics`, `area:docs`

**Problem**
Neue/kaputte Projekte ohne Expo Config bleiben ohne schnellen Startfix hängen.

**Steps to reproduce**
1. Projekt ohne `app.json` und ohne `app.config.js` prüfen.
2. `expo-config-validation` FAIL.

**Acceptance criteria**
- FAIL bietet Fix „Create minimal app.json“.
- Fix erstellt nur wenn beide Dateien fehlen.
- Minimalinhalt: `expo.name`, `expo.slug`, `expo.version`, `expo.android.package` mit TODO-Placeholdern.

**Test Plan**
- Unit: check liefert FAIL + upsert `app.json`.
- Inhalt enthält die minimalen Pflichtfelder.

**Rollout notes / risk**
- Risiko: Placeholder bleiben zu lange unverändert.
- Mit klarer TODO-Message in explanation/UI abfangen.

---

## 4) Security Safe Assist für Service Role in Workflows
**Title:** P0: Safe Assist für hardcoded `SUPABASE_SERVICE_ROLE_KEY` in Workflows  
**Priority:** P0  
**Labels:** `prio:P0`, `type:security`, `area:github-actions`, `area:diagnostics`

**Problem**
Hardcoded Service-Role-Key in Workflow YAML ist kritisches Security-Risiko.

**Steps to reproduce**
1. Workflow mit `SUPABASE_SERVICE_ROLE_KEY: "<literal>"` prüfen.
2. Security-Check schlägt an.

**Acceptance criteria**
- Check bleibt FAIL, aber liefert Manual Steps inkl. Key-Rotation-Hinweis.
- Safe Assist ersetzt **nur** exakten single-line Scalar bei Key `SUPABASE_SERVICE_ROLE_KEY`.
- Ersatzwert: `${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}`.
- Nicht-exakte Patterns bleiben manual-only (kein riskantes Autofix).

**Test Plan**
- Unit: exact pattern -> fix patch vorhanden.
- Unit: non-exact key pattern -> kein fix patch.

**Rollout notes / risk**
- Sehr konservativ halten, um False-Rewrites zu vermeiden.

---

## 5) Better Manual Steps bei `repo.secret.list`
**Title:** P1: `repo.secret.list` Warnung mit konkreten Token-Permissions  
**Priority:** P1  
**Labels:** `prio:P1`, `type:dx`, `area:diagnostics`

**Problem**
Bei fehlender Secret-Read-Berechtigung ist die Meldung oft zu unscharf.

**Steps to reproduce**
1. Token ohne Actions-Secrets-Read nutzen.
2. Secret-Listing gibt 403.

**Acceptance criteria**
- Warn-Hinweis nennt konkrete benötigte Rechte/Scopes.
- Optional CTA zu GitHub Token Settings.

**Test Plan**
- Unit: 403 -> WARN + konkreter Hinweistext.

**Rollout notes / risk**
- Niedriges Risiko, reine DX-Verbesserung.

---

## 6) Invariant String Tests Pack
**Title:** P2: Schneller Invariant-Testpack gegen Hardcoding-/Gate-Regressionen  
**Priority:** P2  
**Labels:** `prio:P2`, `type:tests`, `area:build-gate`, `area:diagnostics`

**Problem**
Kleine Hardcoding-Regressionen können Buildflow still brechen.

**Steps to reproduce**
1. Schlüssel-Strings/Workflownamen/Profile ändern.
2. Ohne Invariant-Tests bleibt das ggf. unentdeckt.

**Acceptance criteria**
- 5–10 schnelle Jest-Invariant-Tests vorhanden.
- Decken Canonical-Keys/Profile/Workflow-Filenames/Gate-Strings ab.

**Test Plan**
- Unit: string/invariant assertions (<1s).

**Rollout notes / risk**
- Kein Produktivrisiko, reine Sicherheitsleine.
