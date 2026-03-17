- [x] Patch 475 (2026-03-17): Persistenz-/ProjectContext-Restpunkte konservativ gehärtet (Storage-Size/Safety-Guard vor `saveProjectToStorage`-Writes inkl. Soft-/Hard-Limit-Verhalten + minimal memoisierte `messages`-Referenz im ProjectContext, ergänzt um gezielte Regressionen).
- [x] Patch 474 (2026-03-17): Timeout-Hauptrestpunkt regressionsfest abgesichert (Invariants prüfen harte Timeout-Verdrahtung für Planner/Builder/Validator/Explain und verhindern direkte `runOrchestrator(...)`-Rückfälle im Chat-Flow).
- [x] Patch 473 (2026-03-17): Chat-AI-Flow-Hauptrestpunkt geschlossen (echter harter Stage-Timeout für Planner/Builder/Validator/Explain mit aktivem Abort und gezielten Timeout/Abort-Regressionen).
- [x] Patch 472 (2026-03-17): AI-/Request-Timeout-Follow-up abgeschlossen (Orchestrator trennt Timeout-Fehlertext jetzt deterministisch von externem Abort; gezielte Regression für timeout-vs-abort ergänzt).
- [x] Patch 471 (2026-03-17): AI-/Request-Robustheitsreste minimal nachgezogen (`runOrchestrator` mit hartem Request-Timeout, kleiner Rotation-Backoff bei 429-Key-Retry, konservativer Builder-Retry-Backoff in `useChatAIFlow`, gezielte Regressionstests für Timeout/Backoff ergänzt).
- [x] Patch 470 (2026-03-16): k1w1-handler-Follow-up abgeschlossen (früher `parseJsonBody(...)`-Error-Pfad leaked kein rohes `parsedBody.error` mehr an Clients, stattdessen konsistente generische Fehlertexte inkl. `Request too large.` bei 413; Catch-Typing minimal auf `unknown` nachgezogen).
- [x] Patch 469 (2026-03-16): Edge-/Preview-Security-Restpunkte minimal-konservativ gehärtet (`preview_page` ohne unsanitized Fehler-HTML/Stack-Interpolation, `k1w1-handler` mit generischen Client-Fehlerantworten statt rohem `err.message`-Leak, gezielte Invariant-Tests ergänzt).
- [x] Patch 468 (2026-03-16): GitHubReposScreen-Architekturblock konservativ beruhigt (Sync-Vergleich zentral über Tree-SHAs statt per-file Contents-Reads, Push auf Git Data API mit einem konsolidierten Commit, bestehende Repo-/Branch-Stale-Guards beibehalten, gezielte Architektur-Invariant-Tests ergänzt).
- [x] Patch 467 (2026-03-16): Allgemeiner flow-naher Maintenance-/Typing-Block konservativ nachgezogen (`useChatAIFlow`-Validator-Map ohne `any`, `useGitHubActionsLogs` Error-Pfad mit `unknown` + toter Import entfernt, `actionsLogsTypes` Edge-Fehlerpayload enger typisiert, `ensureChatHistoryHasIds` auf `unknown[]` + Type-Guard gehärtet).
- [x] Patch 465 (2026-03-16): SettingsScreen/AIContext-Restpunkte final konservativ geschlossen (leeres Retention-Input wird nicht mehr still zu `0`, Retention-Hydration überschreibt keine frisch gesetzten Runtime-Werte mehr, minimale moveKeyToFront-Bereinigung, gezielte Regressionstests ergänzt).
- [x] Patch 464 (2026-03-16): GitHubReposScreen-Defensivfix für malformed `project.files` nachgezogen (typed Normalizer filtert `null`/invalid Legacy-Einträge, keine RepoScreen-Crashes im Local-File-Normalizer-Pfad).

# TODO

Stand: **2026-03-17 (Patch 474)**

> Laufende Restliste für operative Follow-ups.  
> Historische, bereits erledigte Detailpunkte bleiben unten als Archivblock erhalten.

## Aktuell (Priorität)

- [x] **Chat-Nachfix für PR #272 + #273 vollständig geschlossen:** Meta-/lokale Full-line-Kommandos (`cat <pfad>` / `zeige datei <pfad>`) laufen stabil auf unverändertem `rawInput`; Attachment-Hinweis bleibt auf den normalen AI-Pfad begrenzt; Attachment-only (leerer `rawInput`, sinnvoller `aiInput`) wird nicht mehr still verworfen, inkl. Pending-Plan-Handoff-Fallback auf `aiInput` (Patch 461).
- [x] **GitHubReposScreen-Restpunkte (Typing/Sync/Branch) konservativ geschlossen:** Root-`projectFiles` ohne `any[]`-Cast (`ProjectFile[]`), `refreshSyncStatus` mit stale-run-Guard gegen verspätete Updates, `handleCreateRepo` übernimmt GitHub-`default_branch` statt blind `null`, plus minimale Pull-/Push-nahe Cast-Reduktion ohne Architekturumbau (Patch 462).
- [x] **SettingsScreen/AIContext-Restpunkte final nachgezogen:** Leere Retention-Eingabe wird im Save-Pfad explizit als ungültig behandelt (kein stilles `Number("") -> 0`), Runtime-Retention ist gegen verspätete Hydration geschützt, und der kleine `moveKeyToFront`-Fallback bleibt funktional gleich bei weniger doppeltem Try-Code; gezielte Regressionstests sichern beide Kernfälle (Patch 465).
- [x] **Connections Busy-Guard-Fehlersignal entkoppelt (Restpunkt geschlossen):** `withBusyGuard` nutzt jetzt einen dedizierten Busy-Kollisionsfehler statt booleschem `false`, und `saveAll`/`testGitHub`/`testExpo`/`testSupabase` trennen Busy-Konkurrenz sauber von echten Fehlern; dadurch kein irreführender „Ein anderer Save/Test-Lauf ist noch aktiv“-Hinweis mehr nach realen Save-/Test-Fehlern. `useChatAIFlow`-Pending-Plan-Guard wurde gezielt verifiziert und per Invariant abgesichert (Patch 457).
- [x] **OneClickDeploy-Testflake gezielt stabilisiert:** `__tests__/oneClickDeploy.test.tsx` wartet den Press-Start jetzt deterministisch via `act` + Microtask-Flush ab, setzt AsyncStorage-Default-Resolves pro Test explizit und räumt mit `cleanup()` + `jest.clearAllTimers()` strikt auf; dadurch weniger race-/timeout-anfällige Läufe ohne Produktcode-Refactor (Patch 454).
- [x] **KI-/Chat-Nachaudit (misstrauisch) nachgeschärft:** Restlücke im Builder-Fehlerpfad geschlossen: `normalizeAiResponseDetailed` übernimmt `output_text` jetzt als `responseText`, sodass Non-JSON-Antworten mit verständlicher Vorschau enden statt in generischem Fehlerzustand; Regressionstests decken `output_text` und leere Normalisierungsresultate gezielt ab (Patch 453).
- [x] **KI-/Chat-/Prompting-Restpunkte (konservativ) gehärtet:** Projektkontext priorisiert nun relevante Dateien (statt starrer Reihenfolge), Builder behandelt Non-JSON-Antworten als verständliche User-Info mit KI-Preview, State-Drift-Digest nutzt SHA-256 über Pfad+Inhalt (kein same-length Blindspot), Planner-vs-Builder-Routing wurde vorsichtig entschärft, Ownership-/Validator-/Explain-Blocker werden im Nutzerfeedback sichtbar; `k1w1-handler` bleibt weiterhin serverseitiger Edge-Handler und wird im Client-Flow nur dokumentiert/eingeordnet, nicht blind eingebaut (Patch 452).
- [x] **Preview-Restpunkte (Fingerprint/Crash-Recovery/Expiry/Flow-Nahe Dedup) gezielt behoben:** `filesFingerprint` ist content-hash-basiert (same-length Edits erkannt), WebView-Crash-Recovery ist im normalen PreviewScreen analog Fullscreen aktiv, abgelaufene Supabase-URLs werden nicht mehr blind geladen, Preview-Helper/Types wurden dedupliziert (`previewHelpers` als SoT), `previewFiles` hängt nur noch an `projectData?.files`, und der lokale HTML-Fallback ist als transient („nur solange App aktiv ist") explizit markiert (Patch 451).
- [x] **CustomHeader-/CI-Lite-Restprobleme gezielt behoben:** stale `workflowRun`/`logs` werden bei `githubRepo`/`runId`/`workflowId`-Wechsel aktiv zurückgesetzt und durch Request-Key-Guard gegen verspätete Antworten geschützt; Persistenz akzeptiert nur den aktiven CI-Lite-Run (`workflowRun.id===runId` + Repo/Branch-Guard), Doppeltap-Dispatch ist geblockt, `head_sha` ist im `WorkflowRun`-Typ ergänzt, Artifact-JSON lokal typisiert geparst, und CI-Lite-Patch-Sync entfernt `as any` + stabilisiert `syncPatchToGitHub` per `useCallback` (Patch 450).
- [x] **DiagnosticScreen-Restpunkte (Flow/UX/Typing) gezielt behoben:** progressiver Preflight zeigt wieder Severity-Stufe (`stage` statt falschem `priority`-Zugriff), „KI-Fix verfuegbar“ wird nicht mehr für `pass`-Checks angezeigt, plus selektive Typing-/Hook-Cleanups (`projectData`-Casts, `runLocalChecks/runPipelineChecks`-`files`-Typing, `updateProjectFiles`/`deleteFile`-Signaturen, tote Runner-Imports, `clearSelection`-Dependency) inkl. gezielter Regressionstests (Patch 448).
- [x] **EnhancedBuildScreen-Restpunkte (OneClickDeploy/Flow/Typing) gezielt behoben:** OneClickDeploy-Vorab-Push entfernt (SHA-sichere Reihenfolge über `startBuildJob`), unnötiger Doppel-Push vermieden, `canStartBuildUi` gegen Ref-Drift stabilisiert, build-/logs-nahe `WorkflowRun`-Typen inkl. `event` vereinheitlicht und `workflowRun`-`any` in `LogsAnalysisSection` eliminiert (Patch 449).
- [x] **Edge-Typecheck-Restpunkt (Deno/Node-Env in `_shared/auth`) gezielt behoben:** Secret-Lookups laufen jetzt runtime-kompatibel über Deno-oder-Node-Env-Lookup; `npm run typecheck` ist wieder grün, ohne Broad-Refactor (Patch 445).
- [x] **`save_preview` CORS-/Security-Header konsistent gehärtet:** Erfolgs- und lokale Fehlerpfade nutzen nun denselben `_shared/cors`-Header-Stack wie Auth-/Rate-Limit-Fehler; gezielte Invariants sichern Header-Gleichlauf ohne Architekturumbau (Patch 444).
- [x] **k1w1-handler Provider-Randfälle (Anthropic/Gemini) gehärtet:** Anthropic schützt gegen leere Requests bei reinen `system`-Prompts; Gemini trennt `system` explizit via `systemInstruction` und nutzt einen nicht-leeren Fallback für `contents`; doppelte No-op-Coalescing-Stelle entfernt, Invariants ergänzt (Patch 443).
- [x] **UX-Feintuning der Kernpfade (Build/Diagnosis/Preview/Connections/Credentials/Chat-Menü):** Status-Texte und Hinweise auf gespeicherten vs. letzten bekannten Zustand geschärft; technische Formulierungen reduziert und missverständliche Labels vereinheitlicht (Patch 440).
- [x] **Gezieltes Mikro-UX-Finetuning Build/Diagnosis/Preview:** CTA-Labels enttechnisiert, Diagnose-Aktionen klarer benannt, Preview-Status (Live/Fallback/Fehler) konsistenter formuliert; keine Architekturänderung (Patch 441).
- [x] **BuildScreen-Readiness/Status-Hierarchie beruhigt:** Hauptaktion im Autoflow explizit gekennzeichnet, Laufkontext vs. letzter bekannter Build-Kontext getrennt und Checklisten-Texte auf alltagstaugliche Readiness-Sprache angepasst; ohne Backend-/Orchestrierungsumbau (Patch 442).
- [ ] **BuildScreen-Restpunkt (optional):** Begriffe der Build-Historie-Exportaktionen (`Copy JSON` / `Share CSV`) nur bei bestätigtem Nutzerbedarf auf durchgängig deutsches Wording umstellen, um Signalrauschen klein zu halten.
- [x] **Supabase Edge Import-Hygiene (Cross-Boundary):** produktive Workflow-Edges von App-Pfadimport (`shared/constants/github.ts`) entkoppelt; `GITHUB_API_BASE` edge-nah in `_shared/github.ts` verankert + Invariant-Guard ergänzt (Patch 438).
- [x] **Migrations-/RPC-Hygiene für `insert_diagnostic_upload`:** historischer UUID-/Spalten-Drift sauber eingeordnet; finaler `jsonb -> bigint`-Vertrag per Abschlussmigration + Invariant-Guard abgesichert (Patch 436).
- [x] **Follow-up Audit `insert_diagnostic_upload`-Historie:** driftende UUID-Signatur weiterhin nur als dokumentierte Historie erlaubt; zusätzlicher Invariant-Guard verhindert Re-Intro der Legacy-Spaltenannahmen im finalen Vertrag (Patch 439).
- [x] **Supabase Edge E2E-Contract-Audit (App ↔ Edge ↔ DB-Voraussetzungen):** produktiv genutzte Flows geprüft; zentrale Mapping-/Endpoint-Drifts (inkl. Keystore-Wizard + Function-Name-SoT) geschlossen (Patch 433/434).
- [ ] **Supabase Operator-Runbook nachziehen:** Secrets/DB-Objekte/Deploy-Reihenfolge für Signing + Preview + Workflow-Edges als Checkliste konsolidieren (explizit inkl. manueller Supabase-Schritte).
  - Konkret offen: `build_jobs`, `signing_android`, `signing_audit_log`, `previews` (inkl. TTL/Cleanup), Storage-Buckets inkl. Zugriffspfade, sowie Secrets (`K1W1_SUPABASE_URL`, `K1W1_SUPABASE_SERVICE_ROLE_KEY`, `PREVIEW_SUPABASE_URL`, `PREVIEW_SERVICE_ROLE_KEY`, `K1W1_PREVIEW_PAGE_TIMEOUT_MS`, `K1W1_SIGNING_MASTER_KEY`, `K1W1_SIGNING_BUCKET`, `K1W1_EDGE_ADMIN_KEY`, GitHub token envs).

- [ ] **MD-/Notes-Cleanup abschließen (Kernflächen):** README / INDEX / OVERVIEW / SCREEN-INDEX / PRODUCT-FLOWS weiter konsistent halten, Redundanzen klein halten, operative Navigation priorisieren.
- [ ] **Dokument-SoT scharf halten:** Kern-MDs als Navigations- und Vertragsfläche; Verlaufsdetails primär in Patchnotes/Patchlog.
- [ ] **Trust-Follow-up dokumentieren:** frischer Checkout als Green-Path festhalten (`npm ci` + `typecheck` + `lint:ci` + `test:silent`, inkl. Voraussetzungen).
- [x] **Workflow-Ref-Hardening ausbauen:** zusätzliche Invariants/Jest-Guards gegen implizite Default-Deploypfade. (Patch 420)
- [x] **Android-Keystore-Status konsistent zur Helper-Struktur gezogen:** `android-keystore-status` nutzt jetzt wie `generate`/`export` eine lokale `helpers.ts` statt Inline-Duplikate (Patch 439).
- [x] **Polling-/Hook-Stabilität für `useBuildStatus` gehärtet:** unnötige Effect-Resets bei Status- und Callback-Identity-Wechsel entfernt (`statusRef`/`callbacksRef`), Polling bleibt ruhiger (Patch 439).
- [x] **ProjectContext-History-Effect entkoppelt:** unnötige `currentBuild`-Abhängigkeitskaskade entfernt, Auswahl via Ref stabilisiert (Patch 439).
- [x] **Selektiver `any`-Hotspot im Build-Status-Edge reduziert:** `check-eas-build` verwendet nun ein explizites `BuildJobRow` statt untypisiertem `any`-Flow (Patch 439).
- [x] **Build-Start-Flow-`any` selektiv reduziert:** `buildStartService` nutzt für Edge-Invoke-Payload jetzt ein lokales, enges Payload-Narrowing statt mehrfacher `as any`-Zugriffe; Build-Fehler- und Job-ID-Mapping bleiben verhaltensgleich (Patch 446).
- [x] **Edge-Shared-Validation-/Runtime-`any` selektiv reduziert:** `_shared/auth.ts` und `_shared/cors.ts` nutzen getypte Runtime-Globals statt `globalThis as any`; `_shared/validation.ts` hat engere Fehler-/Payload-Typen für Trigger/Workflow-Dispatch (Patch 447).
- [ ] **Rest-`any` nur weiter selektiv abbauen:** verbleibende Hotspots (z. B. einige ältere Edge-Helfer und nicht-flow-kritische App-Hilfsmodule) weiter nur dort anfassen, wo reale Build-/Repo-/CI-/Diagnostic-Vertragsrisiken bestehen (kein Broad Cleanup).

## Wichtige Vertrags-Reminder

- CI-Lite-Chain bleibt bewusst branch-basiert (dokumentierte Ausnahme).
- Produktive Deploy-/Build-Flows bleiben explizit ref-gesteuert.
- Build-Job-Vertrag bleibt auf **positive numerische `jobId`** ausgerichtet.
- Diagnostics-Upload-ID im Client bleibt opaque string.
- Service-Role-Key bleibt aus Client-Pfaden entfernt; CI/Workflows nutzen explizite Guards.

## Kürzlich abgeschlossen (Kontext)

- [x] Patch 449 — EnhancedBuildScreen-Restpunkte fokussiert geschlossen: OneClickDeploy ohne Vorab-Push (SHA-sicher über Build-Start-Flow), `canStartBuildUi` ohne Ref-Lesen im `useMemo`, `WorkflowRun`-Typing Build↔Logs vereinheitlicht inkl. `event`, `LogsAnalysisSection` ohne `any`-Run-Typ.
- [x] Patch 447 — kleiner Edge-Typing-Follow-up: `_shared/auth`/`_shared/cors` ohne `globalThis as any`, `_shared/validation` mit engeren Objekt-/Union-Typen und zusätzlicher `parseJsonBody`-Regression.
- [x] Patch 446 — letzter selektiver Build-Start-`any`-Hotspot reduziert: Edge-Invoke-Payload lokal typisiert/narrowed, `pushFilesToRepo`-Cast entfernt und gezielte Regressionstests für `job.id`-/Error-Shape ergänzt.
- [x] Patch 440 — konservatives UX-/Flow-Feintuning ohne Architekturumbau: klarere Statussemantik (gespeichert vs. letzter bekannter Stand), konsistentere Header-/Fallback-Texte in Build, Diagnosis, Preview, Connections, Credentials und Chat-Menü; gezielte Regression für Preview-Status-Text ergänzt.
- [x] Patch 441 — fokussiertes UX-Feintuning für die drei Kernscreens: Build-Status/CTA-Wording beruhigt, Diagnose-Aktionssprache alltagsnäher gemacht und Preview-Statuswörter für Live/Fallback/Fehler vereinheitlicht; bestehende Guard-/Statuslogik unverändert belassen.
- [x] Patch 442 — BuildScreen-Feintuning mit klarem Hauptaktions-Hinweis, ruhigerer Readiness-Sprache in der Checkliste und eindeutiger Trennung von laufendem Kontext vs. letztem bekannten Build-Kontext.
- [x] Patch 438 — Fragile Edge→App-Importkette auf `shared/constants/github.ts` entfernt; betroffene Workflow-Edges auf `_shared/github.ts` umgestellt und per Invariant-Test abgesichert.
- [x] Patch 439 — Keystore-Status-Edge auf gemeinsame Helper-Struktur angeglichen, `useBuildStatus`-Polling-Resets entschärft, `ProjectContext`-History-Effect stabilisiert und einen Build-Flow-`any`-Hotspot typisiert.
- [x] Patch 437 — Doppelte Preview-Migration (`20251226140000`/`20251226160000`) als bestätigte Redundanz eingeordnet; spätere Datei bewusst auf Legacy-No-op umgestellt (keine History-Löschung), damit die Migrationshistorie weniger irreführend ist.
- [x] Patch 436 — `insert_diagnostic_upload`-Vertrag finalisiert: historische Drift dokumentiert, Abschlussmigration + Invariant-Test ergänzt, finaler bigint-Vertrag klargezogen.
- [x] Patch 439 — zusätzliche History-Invariants: UUID-Drift auf bekannte Altmigrationen eingegrenzt und Re-Intro von `repo/branch/mode/platform/report/meta` im finalen Vertrag explizit geblockt.
- [x] Patch 436 — Chat-Change-Summary zeigt Dateipfade wieder korrekt in Bullet-Listen; `createNewProject` nutzt aktuellen `projectData`-Stand ohne stale closure; gezielte Jest-Regressionen ergänzt.
- [x] Patch 435 — End-to-End-Vertragsprüfung weiter abgeschlossen: App↔Edge-Mapping für Preview/Workflow/Artifact/Signing/AI quergelesen; verbleibende Operator-Abhängigkeiten explizit dokumentiert; Artifact-ZIP-Pfadnormalisierung für Windows-Separatoren gehärtet.
- [x] Patch 434 — Supabase-E2E-Contract-Audit abgeschlossen; Function-Name-SoT für Signing/Preview/AI ergänzt, Wizard-Hardcodes entfernt, Invariant-Tests ergänzt.
- [x] Patch 418 V1 — Trust-/Docs-Konsolidierung der Kern-MDs und Sammeln offener Restpunkte.
- [x] Patch 417 V18 — Patch-Artefakt-Re-Commit im Repo-Root bereinigt und per Ignore-Regeln abgesichert.
- [x] Patch 416 — stillgelegte Legacy-Edges auch auf Config-Ebene deaktiviert; Guard-/Invariant-Coverage ergänzt.
- [x] Patch 415 V3 — workflow-/CI-nahe Edge-Auth-Pfade auf gemeinsamen Admin-/CI-Bearer-Guard ausgerichtet.
- [x] Patch 414 V13 — explizite Ref-SoT-Invariants gehärtet; Branch-Vertrag dokumentarisch nachgezogen.
- [x] Patch 413 — restliche stille Repo-/Branch-Fallbacks entfernt; SoT-Regression-Coverage ergänzt.
- [x] Patch 412 — Supabase-Function-Hardening (`search_path`, `PUBLIC`-Execute-Revoke) + Guards.
- [x] Patch 411 V7 — Supabase-Deploy-Workflow auf `workflow_dispatch` + required `ref` gehärtet.
- [x] Patch 410A/410B — Admin-/CI-Auth sauber getrennt, Service-Role-Handhabung aus Client-Pfaden entfernt.
- [x] Patch 409/408 — Upload-ID-/Build-Job-ID-Verträge auf reale bigint-backed Modelle ausgerichtet.

---

## Historischer Backlog (bereits weitgehend abgearbeitet)

### Patch 220 — KI-Model "Auto" entfernen ✅

- [x] Settings/AI: kein "Auto"-Model mehr anzeigen (bei allen Providern)
- [x] Migration: alte Config-Werte `selectedChatMode/selectedAgentMode = auto|auto-*` beim Laden auf konkrete Default-Modelle mappen
- [x] Defaults: neue Installationen starten direkt mit konkreten Default-Models (kein Auto)
- [x] Tests: AIContext Integration Test anpassen (Auto nicht mehr erwartet)

Akzeptanz:
- [x] In Settings taucht nirgends "Auto (...)" als Model auf
- [x] Bestehende Nutzer mit gespeicherter Auto-Config landen nach App-Start automatisch auf einem konkreten Model

### Patch 221 — Connections UX + Docs SoT-Polish ✅

**221-1 — GitHub Scopes UX verbessern**
- [x] StatusCard: Scopes als Badges anzeigen (statt Fließtext)
- [x] Missing required scopes klar markieren (mind. `repo`, `workflow`)
- [x] Akzeptanz: Verbunden + Scopes → sofort erkennbar, ob PAT Rechte reichen

**221-2 — Shortcuts / Next Steps**
- [x] StatusCard: Button `Build/CI` (Drawer Route `EnhancedBuild`) hinzufügen
- [x] EAS Init/Link running: Hinweistext + "Check GitHub Actions (eas-link)"

**221-3 — Supabase Ref/Host Anzeige aufräumen**
- [x] StatusCard: `supabaseRef` prominent anzeigen + Host in Detail
- [x] SupabaseCard: Label `Supabase URL (auto)` → `Supabase URL (abgeleitet)`

**221-4 — Docs / TODO Alignment**
- [x] `docs/TODO.md`: alte Patch-A/B/C Aufgaben (bereits erledigt) als ✅ markieren

### Patch 224 — CI Lite Details + Sync Summary + Repo Hygiene ✅

- [x] CI Lite Modal: Run-Meta anzeigen (Run#, Status, Conclusion, Duration)
- [x] CI Lite Modal: Button „Chat“ (Error-Lines als Chat-Message übernehmen)
- [x] Connections Screen: Sync Summary Modal (klar anzeigen was Sync schreibt)
- [x] Repo Hygiene: `openai` npm package entfernen (unused)
- [x] Format-Altlast: Tabs/Spaces in `App.tsx` bereinigt
- [x] `docs/patches/patch_221.md` anlegen (Commands wie im Screenshot)
- [x] `docs/patches/PATCHLOG_ROOT.md`, `PROJECT_CHECKLOG.md`, `README.md` aktualisieren
- [x] Akzeptanz: niemand sucht mehr nach bereits gefixten TODOs

### Patch 223 — CI Lite Status persistieren + Build Checklist ✅

- [x] CI Lite: Ergebnis (Lint/Typecheck OK + Timestamp) nach Workflow-Completion in AsyncStorage persistieren
- [x] BuildScreen: Checklist Item "CI Lite gruen (TS + ESLint)" anzeigen (non-blocking)
- [x] StorageKeys: CI Lite Keys zentralisiert (kein Drift)

Akzeptanz:
- [x] Nach einem erfolgreichen CI Lite Run bleibt der Status nach App-Restart sichtbar
- [x] EnhancedBuildScreen zeigt CI Lite als Checklist-Item und führt den User klar zum Header-Button

---


### Patch 217 — Connection Screen SoT ✅
- [x] Patch anwenden: `k1w1-a0style_patch_217_FIXED.zip` (enthält Code + Docs (MD) Updates)
- [x] Danach laufen lassen: `npm run typecheck && npm run lint:ci && npm run test:silent`
- [x] Wenn grün: TODO-Items **A1–A3**, **B1–B3**, **C1–C3** unten abhaken
- [x] Wenn rot: Fehlerlog ins Issue / Checklog kopieren (1:1), dann fixen


> Ziel: **alles was zu tun ist steht hier**, so dass man es stumpf abhaken kann.

### Patch 218 — Connections/SoT Feinschliff ✅

**218-1 — GitHub Scopes persistieren & anzeigen (best-effort)**
- [x] Laden (mount) liest `CONN_GITHUB_SCOPES` und zeigt „unknown“ wenn nicht verfügbar.

**218-2 — Connection-Lampen korrekt zurücksetzen wenn Token gelöscht wird**
- [x] Resets implementiert (GitHub/Expo/Supabase)

**218-3 — Stale-Closure Fix: `testSupabase` deps**
- [x] deps ergänzt
- [x] Akzeptanz: Service-Role nachträglich setzen → Test nutzt sicher den aktuellen Key.

**218-4 — StatusCard: Scopes-Detail auch ohne Header ✅**
- [x] Datei: `screens/ConnectionsScreen/components/StatusCard.tsx`
- [x] Wenn GitHub verbunden aber keine Scopes geliefert: `Scopes: unknown` anzeigen.
- [x] Akzeptanz: UI zeigt immer einen klaren Zustand, kein “leerer” Detailtext.

**218-5 — Docs Alignment**
- [x] `docs/patches/patch_218.md` vorhanden
- [x] `docs/patches/PATCHLOG_ROOT.md`, `PROJECT_CHECKLOG.md`, `README.md` aktualisiert
- [x] Akzeptanz: Doku spiegelt realen Stand wider

---

### Patch 226 — Logger Sweep + GitHub Import Fix ✅

- [x] Logger-Sweep: GitHub/Storage Hooks auf `logger.*` statt `console.*`
- [x] Hotfix: kaputtes Import-Block-Format in `hooks/useGitHubRepos.ts` repariert
- [x] Doku: Patchnote + Patchlog/Checklog aktualisiert

### Patch 227 — CI Lite Closure-Hardening + Docs ✅

- [x] `applyPatchFromText` deps vollständig (kein stale-closure bei Repo/Branch-Wechsel)
- [x] Doku: Patchnote + Patchlog/Checklog aktualisiert


### Patch 228 — Dev Commands + Index/README ✅

- [x] `docs/DEV_COMMANDS.md` hinzufügen (Commands/Shortcuts, ohne `rg`)
- [x] `docs/INDEX.md` aktualisieren (inkl. DEV_COMMANDS + Patchlinks)
- [x] `README.md` Hinweis auf DEV_COMMANDS ergänzen

### Patch 229 — CI Lite utils SoT + Docs ✅

- [x] Shared Helper nach `components/ciLite/ciLiteUtils.ts` (einmalige Quelle)
- [x] CI Lite nutzt Helper konsistent (kein Drift zwischen Dateien)
- [x] Patchnote + Patchlog/Checklog/README aktualisiert
---


### Patch 332 — BuildPolling TS-Hardening + Regression-Test ✅

- [x] `project/services/buildPollingService.ts`: `catch (error: unknown)` + sichere JSON-Accessor-Helfer statt `any`
- [x] `__tests__/buildPollingService.test.ts`: neue Regressionstests (non-JSON Antwort, Legacy-Felder, Abort-Timeout)
- [x] Standard-Checks grün (`typecheck`, `lint:ci`, `test:silent`)

### Patch A — CI Lite Bugfix ✅ (Patch 217)
**A1 — Dead Code entfernen: `topContent` wird nie gerendert**
- [x] Datei: `components/CiLiteHeaderButton.tsx`
- [x] Entferne `const topContent = useMemo(...)` komplett **oder** rendere es bewusst (aktuell: nicht benutzt).
- [x] Entferne zugehörige ungenutzte Styles (mindestens `styles.ciBtn`).
- [x] Akzeptanz: Typecheck/Lint grün, kein `{topContent}` missing (weil es nirgendwo existiert), kein unnötiges Memo.

**A2 — Stale-Closure Fix: `applyPatchFromText` Dependencies**
- [x] Datei: `components/CiLiteHeaderButton.tsx`
- [x] `applyPatchFromText` nutzt u.a. `githubRepo`, `branch`, `getDefaultBranch`, `pushFilesToRepo`, `deleteRepoFile`, `getGitHubToken`.
- [x] Lösung (minimal): fehlende Werte in deps aufnehmen.
- [x] Lösung (robuster): `useRef` für `githubRepo/branch` oder für „current selection“ und Callback deps schlank halten.
- [x] Akzeptanz: Repo/Branch wechseln → Apply Patch pusht garantiert in das aktuelle Ziel.

**A3 — Unmount Cleanup: Polling Timer**
- [x] Datei: `components/CiLiteHeaderButton.tsx`
- [x] Ergänze `useEffect(() => () => stopPolling(), [stopPolling])` (oder äquivalenter Cleanup).
- [x] Akzeptanz: Navigation/unmount während Polling → kein weiterlaufender Timer, keine setState-after-unmount Warnungen.

### Patch B — Supabase Edge Function Names: echte SoT ✅ (Patch 217)
**B1 — Constants vervollständigen**
- [x] Datei: `shared/constants/supabase.ts`
- [x] Ergänze fehlende Functions:
  - [x] `CHECK_EAS_BUILD` (`check-eas-build`)
  - [x] `SAVE_PREVIEW` (`save_preview`)

**B2 — Hardcodes entfernen (alle Call-Sites)**
- [x] `components/CiLiteHeaderButton.tsx`: `github-workflow-runs`, `github-workflow-dispatch` → Constants
- [x] `project/services/buildStartService.ts`: `trigger-eas-build` → Constant
- [x] `project/services/buildPollingService.ts`: `check-eas-build` → Constant
- [x] `hooks/usePreview.ts`: `save_preview` → Constant
- [x] Akzeptanz: keine `fetch(.../github-workflow-...)` oder `invoke("trigger-eas-build")` Strings mehr.

**B3 — Duplicate Helper entfernen**
- [x] Datei: `project/services/buildPollingService.ts`
- [x] Entferne lokale `getSupabaseEdgeUrl()` (Duplikat)
- [x] Nutze `lib/supabaseEdge.ts` als einzige Quelle.

### Patch C — Storage Keys: SoT ✅ (Patch 217)
**C1 — `diagnostic_last_ok` zentralisieren**
- [x] Datei: `shared/constants/storage.ts` oder `shared/constants/diagnostics.ts` (je nach bestehender Struktur)
- [x] Update:
  - [x] `screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts`
  - [x] `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts`

### Patch D — TokenStore Konsistenz ✅ (Patch 217)
**D1 — SecureStore Error-Handling vereinheitlichen**
- [x] Datei: `infra/github/tokenStore.ts`
- [x] Admin/Signing/ServiceRole Keys nutzen aktuell direkte `SecureStore.*Async` Calls.
- [x] Umstellen auf die gleichen Wrapper/Pattern wie GitHub/Expo (try/catch + konsistente Fehlermeldung).

---

## Status

### Patch 138 — CI Lite (Lint + Typecheck)
- [x] Globaler Header-Button (✅) zum Triggern von GitHub CI Lite + Logs in-app

### Patch 139 — CI Lite Upgrade
- [x] Workflow robuster (Fallback auf `npx eslint` / `npx tsc`) + Log-Artifact
- [x] In-App: Apply Patch (JSON) Panel im CI Lite Modal
- [x] Neuer Workflow `.github/workflows/k1w1-ci-lite.yml` (read-only checks)

### Patch 140 — CI Lite Autofix Split
- [x] Neuer Workflow `.github/workflows/k1w1-ci-lite-autofix.yml` (ESLint --fix + guarded writeback + verify)
- [x] In-App Autofix Button triggert separaten Workflow

### Patch 141 — CI Lite Chain-Run + UI Polish
- [x] Autofix → automatisch CI Lite Chain-Run (gleiche `job_id`)

### Patch 145 — CI Lite Compact Modal + Drawer Cleanup
- [x] CI Lite als zentriertes Modal (errors-only, minimal Actions)
- [x] Header Icons konsistent neon
- [x] Drawer: keine doppelten Menüs, Card/Plate Look
- [x] Header-Optik/Neon-Dark: Status-Lämpchen + Running-Pulse

### Patch 142 — Selection Sync + Glow (WICHTIG)
- [x] **Single Source of Truth**: `projectData.linkedRepo/linkedBranch` wird in `GitHubContext` gespiegelt
- [x] **Selection Glow**: ausgewähltes Repo/Branch/Profile bekommt Neon-Rand/Glow + Lamp
- [x] Fix: Patch 141 TypeScript-Order (`stopPolling`/`findRunByJobId`) – Typecheck wieder grün

### Patch 143 — Drawer UI Neon Polish
- [x] Drawer/Sidebar optisch angepasst (Neon Dark + Quick Actions + Chips)
- [x] Cleanup-Note: Backup-Dateien nicht im Repo lassen

### Patch 144 — Drawer UI Grafisch Rund
- [x] Grafische Overlays + Section Icons/Lines
- [x] Pulse-Lämpchen + aktiver Gradient-Rail
- [x] Remove old backup file (`components/ChatHeaderActions.tsx.bak.ui-polish`)

### Patch 107 — Workflows/Templates
- [x] Workflows: `ref`-Fallback auf aktuellen Branch (manueller Run ohne `ref` baut den aktiven Branch)
- [x] Templates (sdk54 base/full) mit den korrigierten Workflows synchronisiert
- [x] Optional: Entscheiden ob „auto-sync GitHub Secrets vor Build“ überhaupt gewünscht ist (opt-in Toggle), **nicht** default ✅ *(patch 312: Default AUS + Toggle im One-Click Deploy)*


- ✅ Screens/Reviews sind vollständig unter `docs/reviews/*_VERIFICATION.md` dokumentiert (siehe Index: `docs/reviews/SCREENS_VERIFICATION.md`).
- ✅ Supabase Edge Functions & DB-Migration wurden gehärtet (RLS + Error-Sanitization), siehe `docs/reviews/SUPABASE_MIGRATION_VERIFICATION.md`.

## Backlog (noch offen)

> Quelle: kritisches Review (zusammengeführt).  
> **P2 = sollte**, **P3 = nice-to-have**.

### GitHubReposScreen

- [x] **RS-004 (P2)** Unmount-Guard / Abort für `onRefresh` (Race: setState nach unmount)  ✅ *(patch 91)*
  _Ort_: `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
- [x] **RS-005 (P2)** Striktere `owner/repo`-Validierung + Tests (`splitFullName`/Parsing)  ✅ *(patch 91)*
  _Ort_: `screens/GitHubReposScreen/utils/repos.ts` (+ Tests in `__tests__/`)
- [x] **RS-006 (P3)** Repo-Liste virtualisieren (FlatList) ohne VirtualizedList-Warnungen ✅ *(patch 94)*  
  _Ort_: `screens/GitHubReposScreen/index.tsx`
- [x] **RS-008 (P2/P3)** Tests: Selection-Consistency, Branch-Race, Modal-Idempotency ✅ *(patch 79, 91, 92, 94-96)*  
  _Ort_: `__tests__/` (Screen-/Hook-Tests)
- [x] **RS-462-A (P1/P2)** Root-`projectFiles as any[]`-Cast im RepoScreen-Hook entfernt und Pull-/Push-nahe Folge-Casts reduziert ✅ *(patch 462)*  
  _Ort_: `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
- [x] **RS-462-B (P1/P2)** `refreshSyncStatus` gegen stale Async-Läufe (Repo/Branch-Wechsel) gehärtet ✅ *(patch 462)*  
  _Ort_: `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
- [x] **RS-462-C (P1/P2)** Repo-Erstellung übernimmt `default_branch` direkt, statt Branch-Kontext auf `null` zu verlieren ✅ *(patch 462)*  
  _Ort_: `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`, `hooks/gitHubReposTypes.ts`
- [x] **RS-468-A (P1/P2)** Letzter GitHubReposScreen-Architekturblock entschärft: Sync-Vergleich zentralisiert (`compareLocalFilesWithRepo`) und Push konsolidiert über Git Data API (Tree/Commit/Ref) statt N Contents-Commits ✅ *(patch 468)*  
  _Ort_: `infra/github/files.ts`, `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`, `__tests__/patch468.githubReposScreen.architecture.invariants.test.ts`

### ConnectionsScreen

- [x] **CS-006 (P2)** Security-/Regression-Tests für Masking/Validation (Tokens/Keys) ✅ *(patch 97)*  
  _Ort_: `screens/ConnectionsScreen/utils/validation.ts` + `__tests__/connectionsScreen.validation.test.ts`
- [x] **CS-455-A (P1/P2)** Supabase-ANON-Key in Connections-Flow konsistent über SecureStore statt AsyncStorage persistieren (inkl. Legacy-Migration) ✅ *(patch 455)*  
  _Ort_: `lib/supabaseAnonKeyStorage.ts`, `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`, `lib/supabase.ts`
- [x] **CS-455-B (P1)** Busy-/Parallel-Execution für `saveAll` + `testGitHub` + `testExpo` + `testSupabase` blockieren (ehrliche Busy-UI) ✅ *(patch 455)*  
  _Ort_: `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`, `screens/ConnectionsScreen/index.tsx`
- [x] **CS-455-C (P2)** `testExpo` ohne versteckte Token-Persistenz; Persistenz nur über explizites Speichern/Import ✅ *(patch 455)*  
  _Ort_: `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`
- [x] **CS-455-D (P2)** EAS-Link-Start setzt Lampe nicht mehr optimistisch auf grün; bleibt bis echter EAS-Verifikation neutral/false ✅ *(patch 455)*  
  _Ort_: `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`
- [ ] **CS-REST-001 (P2)** Optionaler Feinschliff: konsistente Busy-UX auch für EAS-Test (`testEas`) auf denselben globalen Guard/Spinner zusammenführen (derzeit parallel-blockiert via `busyRef`, aber eigener `isTestingEas`-Pfad).  
  _Ort_: `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`

### Supabase (Audit / Ops)

- [x] **SB-RLS-002 (P2)** RLS/Policies auditieren (least privilege) ✅ *(patch 98/99)*  
  _Ort_: `supabase/migrations/*` + `docs/reviews/SUPABASE_MIGRATION_VERIFICATION.md`
- [x] **SB-FN-003 (P2)** Edge error sanitization: sicherstellen, dass **alle** Functions den shared sanitizer nutzen ✅ *(patch 98/99)*  
  _Ort_: `supabase/functions/*`
- [x] **SB-MIG-001 (P2)** Migration-Runbook ergänzen (Roll-forward/Rollback, smoke checks) ✅ *(patch 98)*  
  _Ort_: `docs/runbooks/SUPABASE_DEPLOY_AND_MIGRATIONS.md`
- [x] **SB-DEPLOY-004 (P1/P2)** Edge Deploy: Deno-Imports müssen `.ts` haben (sonst "Module not found" bei `supabase functions deploy`) ✅ *(patch 100)*
  _Ort_: `supabase/functions/_shared/cors.ts` + Functions, die `errorSanitization` importieren
- [x] **SB-TEST-001 (P2)** Unit-Tests für Error-Sanitizer (Transport-Sanitization) ✅ *(patch 98/99)*  
  _Ort_: `__tests__/supabaseErrorSanitization.test.ts`

- [x] **SB-STORAGE-005 (P2)** Storage Bucket `signing`: Migration hat Guard für `insufficient_privilege`, Runbook dokumentiert Troubleshooting ✅ *(bereits implementiert)*
  _Ort_: `supabase/migrations/20260213000000_rls_audit_hardening.sql` (Zeilen 75-78) + `docs/runbooks/SUPABASE_DEPLOY_AND_MIGRATIONS.md` (Zeilen 82-88)

## Abgeschlossen (Kurzlog)

- **Patch 75–78**: TerminalScreen privacy/perf + Secret-Redaction + Tests  
- **Patch 79**: GitHubReposScreen selection consistency + race guard  
- **Patch 80**: Jest open handles fix (ChatScreen cleanup/unref)  
- **Patch 81**: SettingsScreen API-Key masking + validation  
- **Patch 82–84**: ConnectionsScreen masking/validation/sanitization  
- **Patch 85–86**: EnhancedBuildScreen hardening (Status union + guards)  
- **Patch 87**: Supabase hardening (RLS + Edge error sanitization + migration)
- **Patch 91–92**: GitHubReposScreen strict parsing + whitespace rejection + tests
- **Patch 93**: Docs/status refresh + consolidated review notes
- **Patch 94–96**: GitHubReposScreen list virtualization + list flow tests + jest mock hardening
- **Patch 97**: ConnectionsScreen extract validation utils + security/regression tests
- **Patch 98/99**: Supabase RLS audit hardening + sanitizer everywhere + runbook + tests (+ TS fixes + unified redaction marker)
- **Patch 100**: Supabase deploy fix (Deno import extensions) + migration guard for `storage.objects` privileges
- **Patch 101**: Supabase preview_page safe logging (sanitize alle Error-Logs) + create_codesandbox Template-Fix + Docs (TODO/Verification/Checklog)
- **Patch 102**: ChatScreen: Legacy Chat-History Migration (fehlende `id`/`timestamp`) + tolerant keyExtractor + Tests
- **Patch 103**: ChatScreen/Privacy: Fix default Retention (missing setting key no longer wipes Chat-History)
- **Patch 104**: ChatScreen Hardening
- **Patch 458**: ChatScreen/Chat-Flow Restpunkte geschlossen (ehrlicher Attachment-Hinweis statt Scheinanalyse, Retention-Pruning beim Append, Pending/Modal-Cleanup beim Blur, chatAIFlow-Typing-Hygiene)
- **Patch 108**: Connections/Supabase: RLS-aware Supabase-Test + LayoutAnimation Warnungen im New Architecture unterdrückt
- **Patch 134**: ConnectionsScreen Hook Hotfix (duplicate effectiveRepo Declaration entfernt)
- **Patch 109**: Build: GitHub Actions Logs – status-genaue Fehlermeldungen + Edge Function github-workflow-logs Auth/RateLimit Fix (AI-flow stale-closure fix via refs, bounded AutoFix queue, debounced scroll+one retry, modal summary truncation, confirm dialogs)



### CodeScreen

- [x] **CODE-466 (P1)** WebCodeEditor Crash-Recovery im CodeScreen verdrahtet (`onContentProcessDidTerminate`/`onRenderProcessGone`) mit Wiederverwendung des bestehenden Preview-Shared-Recovery-Patterns, ohne neue Editor-Architektur.
  _Ort_: `screens/CodeScreen/components/WebCodeEditor.tsx`, `screens/shared/preview/useWebViewCrashRecovery.ts`
- [x] **CODE-466 (P1/P2)** Folder-Delete im CodeScreen von sequentiell auf batched umgestellt (`deleteFiles(...)`), inkl. minimaler Context-API-Erweiterung für einen einzigen Storage-Write statt N Einzelschritten.
  _Ort_: `screens/CodeScreen/hooks/useFileActions.ts`, `contexts/ProjectContext.tsx`, `contexts/projectTypes.ts`
- [x] **CODE-466 (P2)** Delete-Handler-Schutz gehärtet (`handleDeleteFile` mit explizitem Guard bei fehlendem Target), plus flow-nahe Cleanup-Reste (tote Imports) und Regressionstests.
  _Ort_: `screens/CodeScreen/hooks/useFileActions.ts`, `__tests__/useFileActions.regression.test.tsx`, `__tests__/webCodeEditor.recovery.test.tsx`

- [x] **CODE-105 (P1/P2)** CodeScreen: Save await + Folder-Delete deterministisch + selectedFile cleanup ✅ *(patch 105)*  
  _Ort_: `screens/CodeScreen/hooks/useFileEditor.ts`, `screens/CodeScreen/hooks/useFileActions.ts`  
- [x] **CODE-105 (P2/P3)** CodeScreen UX/Consistency: Modal/Dialog reset, selectAll scoped, ImageViewer size fix, FileTree empty-folder fix ✅ *(patch 105)*  
  _Ort_: `components/*`, `screens/CodeScreen/*`, `utils/syntaxValidator.ts`

### DiagnosticScreen

- [x] **DIAG-448 (P1)** Progressive Preflight-Stage nutzt korrekt `stage` (Severity wird im Fortschritt sichtbar) ✅ *(patch 448)*
  _Ort_: `screens/DiagnosticScreen/hooks/diagnosticRunners.ts`
- [x] **DIAG-448 (P1)** „KI-Fix verfuegbar“ wird nicht mehr für `pass`-Items gerendert ✅ *(patch 448)*
  _Ort_: `screens/DiagnosticScreen/index.tsx`
- [x] **DIAG-448 (P2)** Flow-nahe Typing-/Hook-Restpunkte im DiagnosticScreen bereinigt (unnötige Casts, Hook-Dependencies, Runner-Typen) ✅ *(patch 448)*
  _Ort_: `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts`, `screens/DiagnosticScreen/hooks/diagnosticRunners.ts`, `screens/DiagnosticScreen/index.tsx`
- [x] **DIAG-106 (P1)** `applyPatch`: Delete-Fehler nicht schlucken (keine File-Leichen / kein projectRef-Phantom-State) ✅ *(patch 106)*  
  _Ort_: `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts`
- [x] **DIAG-106 (P2)** Batch-Progress: `setFixStepIndex` auch für Apply-Steps ✅ *(patch 106)*  
  _Ort_: `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts`
- [x] **DIAG-106 (P2)** `undoAll`: Busy-Guard + `finally` Cleanup (kein Doppel-Undo) ✅ *(patch 106)*  
  _Ort_: `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts`
- [x] **DIAG-106 (P2)** HeaderStats: Projektname hängt von `projectData?.name` ab (kein stale Name) ✅ *(patch 106)*  
  _Ort_: `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts`
- [x] **DIAG-106 (P3)** Preferences: AsyncStorage Fehler loggen statt still schlucken ✅ *(patch 106)*  
  _Ort_: `screens/DiagnosticScreen/hooks/useDiagnosticPreferences.ts`
- [x] **DIAG-106 (P3)** `AUTOFIX_MAX` Single-Source (kein Duplikat in UI) ✅ *(patch 106)*  
  _Ort_: `screens/DiagnosticScreen/hooks/useDiagnosticFixRunner.ts`, `screens/DiagnosticScreen/components/NonIssuesTabSection.tsx`
- [x] **BUILD-110 (P1)** GitHub Actions Logs: 404 (logs zip) wird als "not ready" behandelt + klarer Hinweis run-id vs run-number ✅ *(patch 110)*
  _Ort_: `supabase/functions/github-workflow-logs`, `hooks/useGitHubActionsLogs.ts`


- [x] Patch 112: Workflow YAML fix + managed workflow updates
- [x] Patch 112: Managed workflow updates + YAML colon-in-name fix for k1w1-triggered-build


### Patch 217 — Connection Screen SoT ✅

**E1 — EAS Link Workflow = Source of Truth (persistent)**
- [x] Screen: `screens/ConnectionsScreen/*`
- [x] Wenn EAS Project ID leer: Confirm-Dialog "Keine EAS ID vorhanden! Soll eine erstellt werden?" mit `[Abbrechen] [OK]`
- [x] Bei OK: starte `eas-link.yml` ohne `eas_project_id` (Workflow erstellt/verlinkt und committed `eas-project.json`)
- [x] Akzeptanz: Nach erfolgreichem Workflow wird Status-Lampe **grün** und bleibt persistent (`STORAGE_KEYS.CONN_EAS_OK`).

**E2 — Repo/Supabase/Expo Status persistent**
- [x] Persistente Lampen über `lib/storageKeys.ts` (`CONN_REPO_*`, `CONN_SUPABASE_OK`, `CONN_SUPABASE_REF`, `CONN_EXPO_OK`, `CONN_EXPO_USER`)
- [x] Akzeptanz: App neu starten → Status bleibt korrekt.

**E3 — GitHub: Username + optional Scopes anzeigen**
- [x] Nach GitHub-Test: Username speichern + anzeigen (`CONN_GITHUB_USER`)
- [x] Optional: Token-Scopes aus `x-oauth-scopes` speichern + anzeigen (`CONN_GITHUB_SCOPES`)
- [x] Akzeptanz: Wenn Header fehlt → UI zeigt nichts kaputt, nur keine Scopes.


### Patch 219 — AI Provider Hardening + Docs/Examples SoT + Connections Polish

- [x] Remove phantom model defaults (OpenAI/Anthropic) → use real model IDs
- [x] OpenAI request payload: remove unsupported fields (verbosity)
- [x] Gemini: send multi-turn contents + systemInstruction (no flat prompt string)
- [x] SecureKeyManager: rotation listener instead of monkey-patching in AIContext
- [x] FileWriter: remove overly-aggressive substring reference check (avoid false positives)
- [x] ProjectContext: replace console.log spam with logger
- [x] Docs: update .github/workflows/README.md examples to use SUPABASE_EDGE_FUNCTIONS constants
- [x] Connections: show GitHub scopes cleaner + show Supabase ref (if available)

## Patch 226 (Cleanup)
- [x] Logger sweep: remaining console logs in GitHub/Storage hooks


- [x] Add DEV_COMMANDS.md (git grep / grep alternatives when rg is missing)
