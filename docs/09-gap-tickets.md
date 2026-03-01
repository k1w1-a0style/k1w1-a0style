# 09 — Gap Tickets (Diagnostics/Fix/Gate) — P0/P1/P2/P3

Stand: 2026-03-01

Dieses Dokument ist **Issue-ready** (copy/paste in GitHub Issues).  
Prioritäten:
- **P0 (Blocker):** Buildflow nicht zuverlässig startbar / Security risk / harte Gate-Regression
- **P1 (High):** häufige Stuck states / wichtige DX-Fails
- **P2 (Medium):** Stabilität/Regression-Guards
- **P3 (Low):** Nice-to-have

Empfohlene Labels:
- `prio:P0|P1|P2|P3`
- `type:bug|type:enhancement|type:security|type:dx|type:tests`
- `area:diagnostics|area:build-gate|area:eas|area:github-actions|area:docs|area:patch-engine|area:ui`

---

## Ticket 1 — P0 — AutoFix Flow: `repo.easProjectId` (EAS projectId fehlt)

**Labels:** `prio:P0`, `type:enhancement`, `area:eas`, `area:diagnostics`, `area:build-gate`  
**Problem:** Pipeline-Check `repo.easProjectId` ist Blocker, aber der Fix ist aktuell “Manual/Outside”.  
**Ziel:** Ein One-Click Fix, der den User aus dem Blocker holt.

**Akzeptanzkriterien**
- Diagnostics zeigt bei `repo.easProjectId` FAIL eine **Fix Action** an.
- Fix action führt zu **einem** von:
  1) Trigger `eas-link.yml` (Workflow dispatch), oder
  2) interner “EAS Link Wizard” (projectId erzeugen + in repo schreiben)
- Nach Fix + Re-Scan: `repo.easProjectId` → PASS.

**Tests**
- Jest: pipeline diagnostics emits FAIL when missing
- Jest: fix action invokes workflow dispatch (mock)
- Jest: re-run shows PASS when eas-project.json present

---

## Ticket 2 — P0 — AutoFix Template: `repo.easJson` / fehlende Profile

**Labels:** `prio:P0`, `type:enhancement`, `area:eas`, `area:diagnostics`, `area:patch-engine`  
**Problem:** Fehlt `eas.json` oder fehlen `build.<profile>` Blöcke, ist Build nicht startbar; Fix ist zu manuell.

**Akzeptanzkriterien**
- Bei `repo.easJson` FAIL oder `repo.easProfile.*` FAIL: Fix button **Apply canonical eas.json**
- Patch Engine nutzt `upsert` (full file) oder `jsonMerge` (add missing blocks) deterministisch
- Enthält Minimum:
  - `build.development`, `build.preview`, `build.production`
  - android buildType `apk`
  - dev/preview `withoutCredentials: true`
  - production `withoutCredentials: false` (oder absent) + klar dokumentiert

**Tests**
- Jest: missing eas.json → fix patch present → apply patch creates file
- Jest: missing profile blocks → fix adds blocks without overwriting siblings

---

## Ticket 3 — P0 — AutoFix “Minimal app.json” wenn Expo config fehlt

**Labels:** `prio:P0`, `type:enhancement`, `area:diagnostics`, `area:docs`  
**Problem:** `expo-config-validation` kann FAIL sein (kein app.json/app.config). Fix ist manuell und bremst neue Projekte.

**Akzeptanzkriterien**
- FAIL zeigt Fix Action “Create minimal app.json”
- app.json enthält mind. `expo.name`, `expo.slug`, `expo.version`, `expo.android.package` (placeholder + UI Hinweis)
- Re-Scan: `expo-config-validation` → WARN/PASS je nach completeness

**Tests**
- Jest: preflight check emits FAIL
- Jest: fix creates app.json and re-run passes

---

## Ticket 4 — P0 — Security Assist: hardcoded Service Role Key in workflow

**Labels:** `prio:P0`, `type:security`, `area:github-actions`, `area:diagnostics`  
**Problem:** Check erkennt hardcoded service role keys (gut). Fix path muss “idiotensicher” sein.

**Akzeptanzkriterien**
- Diagnostics zeigt klare Manual Steps inkl. “rotate key” und “replace with secrets.*”
- Optional: Safe Assist Fix (nur bei eindeutiger single-line scalar) ersetzt durch `${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}`

**Tests**
- Jest: detection flags hardcoded string
- Jest: safe-assist fix only fires when safe, otherwise no patch

---

## Ticket 5 — P1 — Better Manual Steps: `repo.secret.list` Permission Problem

**Labels:** `prio:P1`, `type:dx`, `area:diagnostics`  
**Problem:** Wenn GitHub token keine “Actions secrets read” Permission hat, Diagnose kann nicht verifizieren → User stuck.

**Akzeptanzkriterien**
- Message nennt konkret required permission/scopes (fine-grained guidance)
- UI zeigt “Open GitHub token settings” CTA (deeplink optional)

**Tests**
- Jest: when API returns 403, check is WARN with proper hint text

---

## Ticket 6 — P2 — Invariant String Tests pack

**Labels:** `prio:P2`, `type:tests`, `area:build-gate`, `area:diagnostics`  
**Goal:** Regression-Guards gegen Hardcoding (repo fallback, branch main fallback, secret name typos, workflow filenames).

**Akzeptanzkriterien**
- 5–10 string/invariant tests existieren und laufen schnell (<1s)
