# 04 — Risk Hotspots

## Top-Risiken (priorisiert)

### `as any`-Audit (Patch 619) — priorisierte Abbaustrategie

- **Inventar (repo-weit):** 260 `as any`-Vorkommen (`rg -n "as any" --glob "!node_modules"`).
- **Kategorisierung (grob):**
  - **A Runtime/Domain/Validation/Config/Networking/Normalizer:** 61
  - **B UI/State/Component-Glue:** 29
  - **C Tests/Mocks/Fixtures:** 163
  - **D Styles/Theming/Interop + Tooling-nahe Reste:** 7+
- **Wichtig:** Nicht jeder Cast hat dasselbe Risiko. Patch 619 reduziert bewusst nur A-Hotspots mit kleinem, robustem Fix ohne Verhaltensumbau.

**Update (Patch 627, 2026-03-30):**
- Neuer Scanstand: **285** `as any`-Vorkommen (statt 291 direkt vor Patch 627).
- In dieser Runde wurden weitere kleine Runtime-/Helper-Hotspots ohne Vertragsumbau reduziert:
  - `supabase/functions/k1w1-handler/helpers.ts` (`parseRequestBody` ohne `body as any`, jetzt Record-Narrowing),
  - `supabase/functions/android-keystore-generate/helpers.ts` (`ensureBucketExists` ohne `supabase as any`, jetzt enger Query-Typ),
  - `lib/diagnostics/templates/patchers/easJson.ts` (`p.defaults as any` entfernt),
  - `lib/diagnostics/templates/runHardChecklist.ts` und `lib/projectMaterializer.ts` (Dateiinhalt-Lesezugriffe ohne `(f as any)?.content`),
  - `screens/GitHubReposScreen/utils/repos.ts` (`dedupeReposById` ohne `(r as any)?.id`).

**Update (Patch 628, 2026-03-30, Durchlauf 2):**
- Im naechsten gezielten A-Pass wurden weitere produktionsnahe Restpunkte reduziert:
  - `lib/notificationService.ts` (Expo-Constants-Zugriff ohne `Constants as any`),
  - `supabase/functions/github-workflow-logs/index.ts` (Error-Narrowing ohne `e as any`),
  - `supabase/functions/create_codesandbox/helpers.ts` (`safeErrorMessage` ohne `(err as any).message`).
- Codefokussierter Scan (ohne `docs/**`/`README.md`) sank von **212** auf **208** `as any`.

**Update (Patch 629, 2026-03-30, Durchlauf 3):**
- Weitere kleine, lokale B-/Glue-Casts ohne Hook-Umbau reduziert:
  - `polyfills.ts` (`globalThis`/console-Zuweisungen ohne `as any`),
  - `screens/CredentialsWizardScreen/index.tsx` und `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts` (`nativeFabricUIManager` ohne `global as any`),
  - `screens/EnhancedBuildScreen/components/WorkflowRunDetailModal.tsx` (`run`-Felder ohne `run as any`),
  - `screens/SettingsScreen/components/ApiKeysSection.tsx` (`PROVIDER_METADATA` ohne Cast),
  - `screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx` (lokale Datei-Content-Zugriffe ohne `(f as any).content`).
- Codefokussierter Scan (ohne `docs/**`/`README.md`) sank von **208** auf **197** `as any`.
**Update (Patch 630, 2026-03-30, Durchlauf 4):**
- Weitere kleine UI-/Interop-Glue-Casts reduziert, ohne Vertragsumbau:
  - `components/CustomHeader.tsx` (Navigation-Calls ohne `as any`),
  - `components/CustomDrawer/index.tsx` (Profil-Read ohne `projectData as any`),
  - `components/FileItem.tsx` und `screens/DiagnosticScreen/components/FixRunModal.tsx` (Ionicon-Namen ohne `icon as any`),
  - `screens/GitHubReposScreen/components/DiffFilesSection.tsx` (Finite-Checks ohne `as any`),
  - `screens/CodeScreen/components/WebCodeEditor.tsx` (`postMessage` ohne `webRef.current as any`),
  - `screens/EnhancedBuildScreen/components/ChecklistSection.tsx` (`FIX_ORDER.indexOf(...)` ohne `id as any`),
  - `screens/GitHubReposScreen/hooks/templateFiles.ts` (Template-JSON ohne `as any[]`).
- Codefokussierter Scan (ohne `docs/**`/`README.md`) sank von **197** auf **187** `as any`.


#### Priorisierte A/B/C/D-Liste (fokussiert auf echte Runtime-Risiken)

| Klasse | Fundstelle | Risiko | Patch-619-Status |
|---|---|---|---|
| **A** | `lib/validators.ts` (`CONFIG as any` fuer Pfad-/Dateigroessen-Policy) | Validierungsgrenzen koennen still ausufern/fehlschlagen, wenn Policy-Typen verdeckt werden. | **Abgebaut** (direkte, getypte Config-Zugriffe). |
| **A** | `lib/supabase.ts` (`process as any` fuer Runtime-Env) | Credentials-/Init-Pfad in produktivem Runtime-Flow; blindes Any verschleiert Env-Shape-Fehler. | **Abgebaut** (getypter Runtime-Env-Adapter). |
| **A** | `lib/supabaseEdge.ts` (`process as any`) | Edge-URL-Resolution fuer produktive Netzwerkrouten. | **Abgebaut** (kleiner `getRuntimeEnv`-Helper). |
| **A** | `lib/normalizer.ts` (mehrere `raw/parsed as any`) | KI-Payload-Normalisierung im Laufzeitpfad; Any kaschiert Strukturfehler/Fallback-Pfade. | **Abgebaut** (Record-Guards + enge Getter). |
| **A** | `lib/diagnostics/buildPipelineDiagnostics.ts` (`readJsonFile<any>`, Canonical-Profile-Cast) | Build-/Config-Diagnostik trifft operative Entscheidungen; Any verschleiert JSON-Shape. | **Abgebaut** (kleine `EasConfig`-Typen + null-safe Reads). |
| **A** | `project/services/projectArchiveService.ts` (`res:any`, `project as any`) | Import/Export-Pfad + Privacy-Reset (`chatHistory`) im Runtime-Flow. | **Abgebaut** (typed return + direkte Property-Nutzung). |
| **B** | `screens/ConnectionsScreen/utils/validation.ts` (`value as any.message`) | Fehlertext-Sanitizing fuer Credentials/UI; mittleres Risiko bei falschem Fehlerpfad. | **Abgebaut** (unknown->message Guard). |
| **C** | `components/*`, `screens/*` Icon-/Style-Casts | Vor allem UI-Interop/Styling, begrenzter Runtime-Schaden. | Offen (niedrige Prioritaet). |
| **D** | `__tests__/*`, `lib/__tests__/*` | Test-Mocks/Fixtures, kein produktiver Laufzeitpfad. | Offen (bewusst toleriert). |

#### Offene, riskante Restpunkte (Stand nach Patch 626)
1. `supabase/functions/*` (`helpers.ts`, `k1w1-handler`, `github-workflow-logs`) — Edge-Runtime-nahe Any-Reste; wegen Auth-/Edge-Vertrag nur separat und mit fokussierten Function-Tests anfassen.
2. `lib/notificationService.ts` (`Constants as any`) — Third-party/Expo-Interop, eher C/E; nur mit klarer Expo-Typstrategie reduzieren.

#### Empfohlene naechste Reihenfolge
1. `supabase/functions/...` (k1w1-handler / workflow-logs / create_codesandbox)
2. `lib/notificationService.ts`
3. danach UI-/Interop-Casts in kleinen thematischen Patches


## Hook-Refactoring-Audit (Patch 618) — priorisierte Hotspots ohne Grossumbau

### Methodik (kurz)
- Repo-weites Inventar fuer `use*.ts` / `use*.tsx` mit Fokus auf Hook-Dateien (Tests ausgeklammert).
- Bewertung nach: Groesse/Dichte, Verantwortungsbreite, Seiteneffekt-Intensitaet, externe IOs (Netzwerk/Storage/Navigation), Testbarkeit, Vertragsnaehe (Build/Auth/Workflow/Preview/Keystore).
- Klassifikation:
  - **A** = hoher Refactoring-Bedarf / hohes Risiko
  - **B** = mittlerer Refactoring-Bedarf
  - **C** = gross, aber aktuell stabil genug
  - **D** = eher unkritisch

### Priorisierte Hook-Liste (A/B/C/D)

| Klasse | Hook | Warum relevant | Empfohlener naechster Schnitt (ohne Umbau in Patch 618) |
|---|---|---|---|
| **A** | `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts` (~1073 LoC) | Sehr breite Mischverantwortung: Repo/Branch CRUD, Pull/Push, EAS-Link, Secrets-Sync, Sync-Status, viele UI-Dialogstates + Async-Orchestrierung. Hohe Regressionsflaeche bei Selection-/Stale-Request-Kanten. | (1) Repo-IO-Orchestrierung (`create/rename/delete/pull/push`) in service-nahe Adapter kapseln, (2) Pull/Push-Modal-State in separaten UI-State-Hook, (3) EAS-Link-Status/Write als eigener Hook-Contract. |
| **A** | `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts` (~945 LoC) | Dispatch + Polling + Chain-Run-Korrelation + Artifact-Read + Persistenz in einem Hook. Timer-/Generation-Guards stabilisieren bereits viel, aber Kopplung bleibt hoch. | (1) Run-Lookup/Polling-FSM auslagern, (2) Artifact-Query separat (read-only + retry policy), (3) Dispatch/Chain-Command vom Header-UI-State trennen. |
| **A** | `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts` (~948 LoC) | Starke Mischung aus Storage-Hydration, Token-/Secret-Handling, Connectivity-Tests, EAS-Verifikation, Navigation/Busy-Guard, UI-Visibility-Toggles. Viele persistente Seiteneffekte. | (1) Persistenz-Layer (`load/save conn lights + tokens`) als Modul, (2) Test-Aktionen pro Provider (`testGitHub/testExpo/testSupabase/testEas`) isolieren, (3) reiner Form/UI-State in eigenen Hook ziehen. |
| **A** | `screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts` (~717 LoC) | Auth-/Keystore-/Workflow-nahe Vertragslogik plus Edge-Calls, Fokus-Effekte, Wizard-UI in einem Block. Hohe Sensitivitaet fuer Build/Auth/Keystore-Vertrag. | (1) Edge-IO-Adapter fuer Keystore/Signing/Preview klar trennen, (2) Schritt-Readiness als pure selector/helper, (3) Fehlernormalisierung vereinheitlichen. |
| **A** | `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts` (~1096 LoC) | Grosser Runner mit Modal-/Step-State, Apply-/Rerun-/Patch-/Sync-Orchestrierung; viele Statuswechsel und Seiteneffekte. | (1) Step-Runner-Pipeline (pure step plan) trennen, (2) Apply-Operationen + Ergebnis-Mapping als eigenes Modul, (3) Modal-/Preview-State entkoppeln. |
| **B** | `hooks/useChatAIFlow.ts` (~1010 LoC) | Gross und orchestration-lastig (Planner/Builder/Validator/Explain), aber in juengeren Patches bereits mehrfach stabilisiert; dennoch hohe kognitive Last. | Weitere kleine pure-function-Extraktionen (Input-Routing, status/error mapping), keine Vertragsaenderung an Orchestrierung. |
| **B** | `screens/AppInfoScreen/hooks/useAppInfoScreen.ts` (~568 LoC) | Viele Verantwortungen (App-Meta, Backup/Restore, Secrets Import/Export, Icon), aber geringere kritische Laufzeitkopplung als A-Hooks. | Secure-Backup-Commands vs. App-Meta-Edit-State trennen; Storage-Reads/Writes in Helper-Layer. |
| **C** | `hooks/usePreview.ts` (~606 LoC) | Gross, aber in Patch 615 bewusst fail-closed gehaertet (Legacy-Operatorgrenze, Remote-SoT). Sehr sensibler Vertrags-Hook. | **Nicht jetzt gross refactoren**; nur mikro-sichere pure helper extractions bei konkretem Bug. |
| **C** | `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts` (~651 LoC) | Build-Flow mit mehreren juengsten Vertragsfixes (Push-/Dispatch-/Filter-Truthfulness). | **Nicht jetzt gross refactoren**; nur fokussierte Regression-fixes an nachweisbaren Kanten. |
| **C** | `hooks/useGitHubActionsLogs.ts` (~365 LoC) | Nicht riesig, aber timing-/abort-sensibel; mehrere Patches haben Request-Version-/Pending-Guards gehaertet. | **Vorerst stabil halten**; nur kleine testgetriebene Anpassungen an Polling/Abort-Kanten. |
| **D** | `hooks/useBuildStatus.ts`, `hooks/useNotifications.ts`, `screens/CodeScreen/hooks/useCodeScreen.ts` | Ueberschaubare Breite, weniger kritische gekoppelte IO-Verantwortung. | Kein prioritaerer Refactorbedarf. |

### Ehrliche "nicht jetzt"-Liste (stabil, aber sensibel)
1. `hooks/usePreview.ts`: juengst gehaerteter fail-closed Preview-/Legacy-Vertrag; grosser Umbau jetzt waere regressionsanfaellig.
2. `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`: mehrere frische Build-Vertragsfixes (Dispatch/Push/Filter); zuerst Stabilitaetsfenster halten.
3. `hooks/useGitHubActionsLogs.ts`: Polling-/Abort-Rennen wurden in kurzer Folge korrigiert; nur kleine, testgedeckte Aenderungen zulassen.

### Empfohlene Refactoring-Reihenfolge (naechste Patches)
1. **A1:** `useGitHubReposScreen` — zuerst IO/UI-State trennen, danach EAS-Link-Unterpfad.
2. **A2:** `useCiLiteWorkflow` — Polling/Lookup-FSM von Dispatch/Artifact/Modal entkoppeln.
3. **A3:** `useConnectionsScreen` — Persistenz + Provider-Tests + UI-State in drei Schichten schneiden.
4. **A4:** `useCredentialsWizardScreen` — IO-Adapter + Step-Selectors + Error-Normalization.
5. **A5:** `useDiagnosticFixRunner` — Runner-Pipeline vs. Modal/UI-State.
6. **B-Hooks** (`useChatAIFlow`, `useAppInfoScreen`) nur in kleinen pure-function-Schnitten nachziehen.
7. **C-Hooks** (`usePreview`, `useEnhancedBuildScreen`, `useGitHubActionsLogs`) erst nach Stabilitaetsfenster und nur bei konkretem Incident.

## R1 — Branch-Fallback auf `main` im kritischen Pfad
**Risiko:** Build/Workflow können gegen falschen Branch laufen, obwohl User andere Auswahl erwartet.  
**Auswirkung:** Falscher Commit/Workflow-Kontext, inkonsistente Diagnosen.

**Fundstellen:**
- `project/services/buildStartService.ts` (`bestEffortPushToGitHub`, Return `branch || "main"`)
- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts` (EAS-Link branch fallback)
- `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts` (mehrere Sync/Repo-Operationen)
- `screens/DiagnosticScreen/hooks/diagnosticRunners.ts`, `useDiagnosticFixRunner.ts`

**Update (Patch 590):** Nach dem gehaerteten Edge-Eingang aus Patch 589 sind jetzt auch die tieferen branch-nahen Shared-Layer gehaertet: `infra/github/workflows.ts`, `infra/github/files.ts` und `infra/github/branchOps.ts` enthalten keine stillen `"main"`-Fallbacks mehr; fehlender Branch/Ref bricht fail-closed ab statt zu raten.
**Update (Patch 612):** Der Build-Start-Flow ist zusaetzlich auf der Repo-Sync-Kante fail-closed gehaertet: Im `out_of_sync`-Pfad fuehrt ein fehlgeschlagenes `pushFilesToRepo(...)` jetzt zu sofortigem Abbruch; Workflow-Autofix/Bootstrap und Dispatch laufen danach nicht mehr an.
**Update (Patch 613):** Dispatch-/Bootstrap-Semantik ist jetzt getrennt: normale Dispatch-Pfade (`triggerWorkflow`, `github-workflow-dispatch`) sind mutation-free/fail-closed und signalisieren fehlende Workflows als `missing_workflow` statt stillen Repo-Writes.
**Update (Patch 614):** Build-Screen-Filter fuer Workflow-Runs ist jetzt UI-truthful: bei aktivem Profilfilter ohne Treffer bleibt die Liste leer (`[]`) statt auf alle Runs zurueckzufallen; ein expliziter Empty State macht den Nulltreffer klar sichtbar.
**Update (Patch 616):** Globale Warnungsunterdrueckung in `App.tsx` wurde auf ein enges Minimum reduziert: breite Ignore-Strings (`Require cycle:`, `VirtualizedLists should never be nested`) sind entfernt, damit Dev-Signale fuer Architektur-/Renderprobleme wieder sichtbar bleiben; nur ein klar dokumentierter Reanimated-Dev-Noise-Restpunkt bleibt bewusst aktiv.

**Fix-Vorschlag:**
1. Harten Branch-Guard einführen: wenn Branch leer ⇒ blockieren mit UI-Fehler.
2. Fallbacks auf `main` entfernen.
3. Nur explizit ausgewählte Branches dispatchen.

---

## R2 — Dual-Write zwischen `active*` (GitHubContext) und `linked*` (ProjectData)
**Risiko:** temporäre Divergenz/Migrationsdrift bei Import/Hydration.  
**Auswirkung:** Screen A zeigt andere Auswahl als Screen B.

**Fundstellen:**
- `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
- `screens/AppInfoScreen/hooks/useAppInfoScreen.ts`
- `contexts/GitHubContext.tsx` (persistiert `active*`, spiegelt aber aus `linked*`)


**Fix-Vorschlag:**
1. `linked*` als einziges Schreibziel definieren.
2. `active*` nur als derived read-model führen (kein eigener User-Write außer Mirror-Mechanik).
3. Import-Flow: nur `setLinkedRepo` schreiben; Mirror folgt automatisch.

---

## R2b — False-Green-Risiko durch Legacy-Admin-Key
**Risiko:** UI/Diagnostics signalisieren Readiness, obwohl nur `K1W1_EDGE_ADMIN_KEY`/Legacy lokal gesetzt ist.
**Auswirkung:** Workflow-/Keystore-Routen schlagen spaeter fehl, obwohl Vorpruefung gruen wirkte.

**Fix-Stand (Patch 596):**
- Connections-UI und SecretsSection trennen lokale Workflow-/Keystore-/Legacy-Keys klar.
- Diagnostics prueft `local.workflowAdminKey` und `local.androidKeystoreExportAdminKey` explizit; Legacy ist nur Compat-Hinweis.
- Patch 597 zieht den Wizard-Caller-Vertrag fuer Keystore-Routen nach: `android-keystore-status`/`android-keystore-generate` laufen dort nur noch mit `Authorization: Bearer <Supabase user JWT>` plus dediziertem lokalem Keystore-Key (`x-k1w1-admin-key`).
- Patch 598 reduziert verbleibende Drift im Legacy-Admin-Guard: generisches `requireAdminKey(...)` akzeptiert keinen `SIGNING_ADMIN_KEY`-Fallback mehr; Legacy-Routen (`k1w1-handler`, `create_codesandbox`, `save_preview`, disabled lint/native-sync Stubs) nutzen jetzt explizite scoped Guards auf `K1W1_EDGE_ADMIN_KEY`.
- Patch 599 schliesst den Keystore-Config-Split-Brain: widerspruechliche lokale `verify_jwt=false`-Configs fuer `android-keystore-status`/`android-keystore-generate` wurden entfernt; fail-closed SoT ist jetzt eindeutig `supabase/config.toml` mit `verify_jwt=true`.
- Patch 608 zieht denselben SoT-Cleanup fuer `android-keystore-export` nach: auch dort gibt es keine funktionslokale `config.toml` mehr, damit alle gehaerteten Keystore-Routen nur noch eine `verify_jwt`-Quelle haben (`supabase/config.toml`).
- Patch 600 entfernt verbleibende stille Legacy-Fallbacks in workflow-/build-/artifact-nahen Ops-Skripten: `scripts/ci-lite-env-load.sh` und `scripts/ci-lite-smoke.sh` verwenden nur noch `K1W1_EDGE_WORKFLOW_ADMIN_KEY` (kein `ADMIN_KEY`/`K1W1_EDGE_ADMIN_KEY`-Alias mehr), damit fehlende scoped Workflow-Keys nicht mehr als false-green durchlaufen.
- Patch 602 schliesst den verbleibenden JWT-/Ref-Vertragsbruch im selben Script-Scope: `scripts/ci-lite-smoke.sh` ruft JWT-pflichtige workflow-/build-nahe Routen nur noch mit `Authorization: Bearer <K1W1_EDGE_WORKFLOW_JWT>` plus scoped Workflow-Key auf und verlangt einen expliziten `<ref>` (kein stilles `main` mehr).
- Patch 601 schliesst den Restpunkt `supabase/functions/test` explizit: alte Testroute ist jetzt fail-closed (`requireScopedEdgeAuth` + immer `410 legacy_test_route_disabled`) und kann nicht mehr als halboffene Altflaeche mit unklarem Auth-Vertrag stehen bleiben.
- Patch 603 korrigiert den verbleibenden Vertragsfehler in genau dieser Testroute: der Scoped-Guard enthaelt jetzt verpflichtend `allowAdmin: true` und `scope: "test"`, damit keine `500`-Auth-Misconfiguration den beabsichtigten `410 legacy_test_route_disabled`-Pfad verdeckt; Contract-Checks/Invariants blocken die Rueckdrift explizit.
- Patch 609 schiebt den Sunset im Client weiter auf scoped-only Runtime: Wizard- und Signing-Gate lesen keinen Legacy-Edge-Key mehr fuer Keystore-Readiness, und SecretsSection wertet fehlenden Legacy-Key nicht mehr als aktuellen Runtime-Blocker; verbleibende Legacy-Reste sind explizit als Compat-/Altpfade begrenzt und per Invariant/Contract-Check abgesichert.
- Patch 615 trennt den Preview-Clientvertrag jetzt ebenfalls fail-closed: der normale `usePreview`-Supabasepfad nutzt den Legacy-Key nicht mehr still; Legacy-`save_preview` ist nur noch ein expliziter Operator-/Maintenance-Compatpfad hinter `EXPO_PUBLIC_ENABLE_LEGACY_PREVIEW_OPERATOR_MODE=true`.
- Patch 620 schliesst den verbleibenden serverseitigen JWT-/RBAC-Read-Drift in `_shared/auth.ts`: nach verifizierter JWT-Pruefung wird die Rolle jetzt primaer aus dem verifizierten Token-Claim gelesen (`role`, dann `app_metadata.role`) statt zuerst aus `auth/v1/user.role`; dadurch lehnen Operator-Routen korrekt provisionierte `build_admin`-JWTs nicht mehr faelschlich als `authenticated` ab, ohne den fail-closed-Vertrag (`service_role|build_admin`) aufzuweichen.
- Patch 622 schliesst den verbleibenden Live-RBAC-Decode-Drift im selben Guard-Pfad: der JWT-Payload wurde bislang nach `atob(...)` ohne UTF-8-Decoding geparst. Non-ASCII in Nebenclaims konnte den Parse kippen und den finalen Rollenvergleich wieder auf den verifizierten User-Rueckfallwert (`authenticated`) driften lassen. Mit UTF-8-sicherem Decode (`TextDecoder`) bleibt `role=build_admin` fuer den Allowlist-Match stabil.

---

**Update (Patch 617):** Der letzte offene Supabase-/Operator-Runbook-Restpunkt ist als verbindlicher Betriebsvertrag dokumentiert (Readiness-Reihenfolge, externe vs. repo-seitige Verantwortung, Troubleshooting fuer Preview/Signing/Workflow). Dadurch bleibt `R2b` bewusst ein Betriebsrisiko, aber nicht mehr ein unklarer TODO-Block.

## R3 — Repo-Fallback via `CONFIG.BUILD.GITHUB_REPO`
**Risiko:** Build startet auf statischem/notfall Repo statt User-Selektion.  
**Auswirkung:** Harte Kopplung, falsches Zielrepo.

**Fundstellen:**
- `contexts/ProjectContext.tsx` (`pd.linkedRepo?.trim() || CONFIG.BUILD.GITHUB_REPO`)
- `project/services/buildStartService.ts` (gleicher Fallback)


**Fix-Vorschlag:**
1. Build blocken, wenn `linkedRepo` fehlt.
2. Config-Fallback nur für expliziten Dev-Testmodus erlauben (Feature Flag + Hinweis).

---

## R4 — Diagnostic/CI-Flags als String-Storage ohne Versionierung
**Risiko:** Alte Keys/States können missverstanden werden; keine Run-Korrelation.  
**Auswirkung:** UI zeigt „grün“, obwohl Zustand alt ist.

**Fundstellen:**
- `lib/storageKeys.ts`
- `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts`
- `screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts`


**Fix-Vorschlag:**
1. Statusobjekt mit Timestamp/Version (z. B. `diagnostic_last_result_v2`) einführen.
2. Build-Precondition kann „stale“ Runs (zu alt) als pending markieren.

---

## R5 — ProjectId/ersId Contract unvollständig dokumentiert
**Risiko:** Unklare Ownership bei EAS Project ID, keine sichtbare `ersId`-Quelle gefunden.  
**Auswirkung:** Lücken im verbindlichen Datenvertrag.

**Status:** **UNSICHER**
- `EAS_PROJECT_ID` ist klar via `AsyncStorage` belegbar.
- `ersId` konnte im geprüften Code nicht gefunden werden.

**Zu prüfen:**
1. Externe Edge-Function Payloads / Backend-Kontrakte (falls `ersId` dort geführt wird).
2. Eventuelle Alt-Dokumente oder Umbenennungen (`easProjectId` vs `ersId`).

---

## Evidence

### Evidence A — Historischer Branch fallback im Build-Service (vor Hardening)
**Datei:** `project/services/buildStartService.ts`  
**Symbol:** `bestEffortPushToGitHub`
```ts
if (!branch) {
  try {
    branch = (await getDefaultBranch(owner, repo)).trim();
  } catch {
    branch = "main";
  }
}
if (!branch) branch = "main";
```

### Evidence B — Repo/Branch-SoT ist jetzt konsolidiert auf `projectData.linked*`
**Datei:** `contexts/GitHubContext.tsx`  
**Symbol:** abgeleitete Active-Selection
```ts
const activeRepo = useMemo(
  () => (hydrated ? normalizeLinkedGitHubValue(projectData?.linkedRepo) : null),
  [hydrated, projectData?.linkedRepo],
);
```

### Evidence C — Repo-Fallback via Config
**Datei:** `project/services/buildStartService.ts`  
**Symbol:** `startBuildJob`
```ts
const githubRepo = (project.linkedRepo?.trim() || CONFIG.BUILD.GITHUB_REPO).trim();
```

### Evidence D — Diagnostics/CI Flags nur key/value
**Datei:** `lib/storageKeys.ts`  
**Symbol:** `STORAGE_KEYS`
```ts
DIAGNOSTIC_LAST_OK: "diagnostic_last_ok",
CI_LITE_LINT_OK: "ci_lite_lint_ok",
CI_LITE_TYPECHECK_OK: "ci_lite_typecheck_ok",
```

## R6 — Workflow-Operator-RBAC bisher zu breit (`authenticated`)
**Risiko:** Breite JWT-Rolle `authenticated` auf privilegierten workflow-/build-/artifact-Routen vergroessert die Angriffsoberflaeche fuer Operator-Aktionen.
**Auswirkung:** Nicht-admin User-JWTs koennen unnötig weitreichende Operator-Routen erreichen, wenn zusaetzliche Guards falsch konfiguriert sind.

**Fundstellen (historisch, vor Patch 586):**
- `trigger-eas-build`, `check-eas-build`, `github-workflow-dispatch`, `github-workflow-runs`, `github-workflow-logs`, `github-run-artifact-json`

**Hardening-Stand (Patch 586):**
1. JWT-Rollen auf `service_role` + `build_admin` eingeschraenkt (fail-closed).
2. Der fruehere CI-bearer-Dualpfad wurde in Patch 606 entfernt; workflow-/build-/artifact-Routen nutzen jetzt nur noch den JWT+scoped-admin-key-Vertrag.
3. Shared SoT (`WORKFLOW_OPERATOR_ALLOWED_ROLES`) verhindert Rollen-Drift zwischen Routen.
4. Patch 607 entfernt die verbliebene tote CI-bearer-Helperlogik aus `_shared/auth.ts`; `requireScopedEdgeAuth(...)` enthaelt keinen CI-bearer-Branch mehr und konserviert keinen ungenutzten Dualvertrag.

**Follow-up (Patch 588):**
4. `android-keystore-generate` und `android-keystore-status` wurden auf denselben dedizierten Keystore-Scoped-Secret-Pfad (`K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY`) plus fail-closed JWT-RBAC (`service_role|build_admin`) gehoben; generischer `requireAdminKey(...)`-Pfad ist dort entfernt.
5. Patch 591 bereinigt den oeffentlichen `android-keystore-generate`-Vertrag: kein irrefuehrendes `branch`-Feld mehr, fachlicher Scope bleibt `repo + mode`.
**Follow-up (Patch 604):**
6. App-Caller-/Wizard-Fehltexte, Vertrags-Tests und Drift-Checks wurden auf denselben Operator-Vertrag gezogen; kein `JWT role=authenticated`-Wording mehr im app-initiierten Operator-Scope.
**Follow-up (Patch 605):**
7. Es gibt im Repo keinen internen Claim-Mapper/Grant-Flow fuer build_admin; der Operator-Claim ist ein externer Supabase-Provisioning-Vertrag (`user.role`/`user.app_metadata.role`) und wird entsprechend in UX/Diagnostics/Docs explizit benannt.
8. Patch 611 verschaerft den operativen Endvertrag als Runbook-/Preflight-Aussage: normale eingeloggte Nutzer ohne extern provisionierten `build_admin`-Claim bleiben auf Operator-Flows bewusst fail-closed blockiert; Troubleshooting verweist explizit auf externes Claim-Provisioning statt auf Repo-Refactor.

---

### Evidence E — `ersId` nicht gefunden (Search Evidence)
**Command:** `rg -n "ersId" contexts screens lib infra project shared`
```txt
(no matches)
```


**Update (Patch 629, 2026-03-30, Durchlauf 3):**
- Weitere kleine, lokale B-/Glue-Casts ohne Hook-Umbau reduziert:
  - `polyfills.ts` (`globalThis`/console-Zuweisungen ohne `as any`),
  - `screens/CredentialsWizardScreen/index.tsx` und `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts` (`nativeFabricUIManager` ohne `global as any`),
  - `screens/EnhancedBuildScreen/components/WorkflowRunDetailModal.tsx` (`run`-Felder ohne `run as any`),
  - `screens/SettingsScreen/components/ApiKeysSection.tsx` (`PROVIDER_METADATA` ohne Cast),
  - `screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx` (lokale Datei-Content-Zugriffe ohne `(f as any).content`).
- Codefokussierter Scan (ohne `docs/**`/`README.md`) sank von **208** auf **197** `as any`.
