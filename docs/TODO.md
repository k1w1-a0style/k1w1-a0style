# TODO

Stand: **2026-04-15 (Patch 782, StatusClarityOkWithSkipsVsOkFull)**
<!-- Legacy marker for docs contract tooling: Stand: **2026-04-02 (Docs Konsolidierung)** -->

> Ehrliche Restpunkt-SoT: getrennt nach (a) jetzt im Repo gefixt, (b) externen Live-/Supabase-Themen, (c) spaeteren Härtungen.

## 1) In diesem Durchlauf im Repo gefixt (nicht-live)

- [x] `EdgeTypecheckBlockerClosure` (Patch 777): offene TS-Fehler in `check-eas-build`/`trigger-eas-build` behoben (Catch-Return-Typing, stabile Supabase-Client-Contracts, sauberes Union-Narrowing und Job-ID-Validierung im Trigger-Flow).
- [x] `ReleaseReadinessLiveEnvSkipFix` (Patch 777): `check_edge_live_env_readiness.sh` behandelt fehlende lokale Live-Env jetzt als SKIP statt Hard-Fail, sodass `verify:release` ohne Live-Secrets wieder korrekt mit `OK_WITH_SKIPS` endet.

- [x] `PreviewEvalFailClosedAndExplicitOptIn` (Patch 776): `buildSandpackHtml(...)` verlangt jetzt zwei explizite Freigaben (`allowUnsafeLocalEval` + `allowExternalCdnInUnsafeLocalEval`); fehlt eine davon, bleibt der lokale Eval-/CDN-Pfad fail-closed mit gesperrtem Hinweis-HTML.
- [x] `PreviewCreationDevOnlyGate` (Patch 776): `usePreviewCreation` aktiviert lokalen Eval/CDN-Pfad nur noch mit `EXPO_PUBLIC_ENABLE_UNSAFE_LOCAL_PREVIEW_EVAL=true` und gleichzeitigem Dev/Test-Runtime-Guard.
- [x] `AppInfoProjectFilesMemoNarrowing` (Patch 776): `useAppInfoScreen` haengt die `projectFiles`-Ableitung nur noch an die tatsaechlichen Materialisierungs-Inputs (`files`, `name`, `slug`, `packageName`) statt am gesamten `projectData`-Objekt.
- [x] `AndroidDebugKeystoreHygiene` (Patch 776): `android/app/debug.keystore` aus VCS entfernt und in `android/.gitignore` als lokales, nicht-versioniertes Debug-Artefakt fixiert.

- [x] `StartupEdgeHintSoftening` (Patch 775): fehlende Edge-URL wird beim Boot nicht mehr als prominenter Loading-Warnzustand angezeigt; stattdessen gibt es einen kleinen, nicht-blockierenden Hinweis direkt in der Supabase-Karte unter Verbindungen.
- [x] `GitHubSecretCryptoModernization` (Patch 774): `tweetsodium` durch aktiv gepflegtes `libsodium-wrappers-sumo` ersetzt; GitHub-Secret-Sealed-Box-Vertrag bleibt verhaltensgleich (`crypto_box_seal`).
- [x] `SigningAndroidRlsPolicyPrecision` (Patch 774): alte grobe Deny-Policy (`PUBLIC`) fuer `signing_android` durch explizite deny-Policy nur fuer `anon, authenticated` ersetzt.
- [x] `SecurityDefinerSearchPathHardeningFollowup` (Patch 774): `enforce_edge_rate_limit(...)` und `insert_diagnostic_upload(jsonb)` auf `search_path = public, pg_temp` nachgezogen.
- [x] `StartupOperabilityGuard` (Patch 774): App-Startup validiert fehlende Edge-URL sichtbar und zeigt bei haengender Initialisierung einen klaren Timeout-Hinweis statt endlosem Spinner.

- [x] `ResidualRestblockFinalization` (Patch 770): finaler Scope-Rescan fuer alle 5 verbleibenden Hotspots abgeschlossen; kein weiterer sicherer Mehrwert-Split in `useCiLiteWorkflow.ts`, `useEnhancedBuildScreen.ts`, `useCredentialsWizardScreen.ts` und `infra/github/workflows.ts` erzwungen (bewusst schlanke Orchestratoren).
- [x] `ChatScreenHookResidualFollowup` (Patch 770): Scroll-Retry-/Primary-Catch in `useChatScreen.ts` meldet Fehler jetzt sichtbar (`logger.warn(...)`) statt still.
- [x] `LiveEdgeTruthfulnessFollowup` (Patch 770): SoT nachgezogen, dass der reale erfolgreiche Live-Lauf fuer `k1w1-handler` mit frischem `build_admin`-JWT lief; `service_role` wird fuer diesen usergebundenen Live-Operatorvertrag nicht als gleichwertiger Ersatz behauptet.
- [x] `LiveVariableAndSecretDocumentation` (Patch 770): `EDGE_BASE_URL`/`EDGE_OPERATOR_JWT` inkl. sicherer Bezugswege und `OK_FULL` vs `OK_WITH_SKIPS` nochmal konsistent in Kern-SoT/Runbooks nachgeschaerft, ohne Secret-Literale.

- [x] `ChatScreenHookResidual` (Patch 769): Prefill-Param-Handling in `useChatScreen` aus der Haupt-Fassade in `chatScreenPrefill.ts` entmischt; Fehler beim Param-Cleanup werden jetzt sichtbar via `logger.warn(...)` statt stummem Catch.
- [x] `CiLiteWorkflowResidual` (Patch 769): Logline-Ableitung aus `useCiLiteWorkflow.ts` in `resolveCiLiteLogLines(...)` ausgelagert; Pending-/Hydrated-/Run-Log-Semantik bleibt unveraendert.
- [x] `EnhancedBuildScreenResidual` (Patch 769): Log-Ableitungen (`analyses`, `logsErrorSafe`, `logLines`) aus dem Haupt-Hook in `useEnhancedBuildLogState.ts` gezogen; Build-/Readiness-/Start-Semantik unveraendert.
- [x] `GitHubWorkflowsInfraResidual` (Patch 769): JSON-Parse-Fehlerpfad im Workflow-Dispatch ist jetzt sichtbar (`logger.warn`) statt stiller Fallback; fail-closed Fehlerbild bleibt gleich.
- [x] `CredentialsWizardScreenResidual` (Patch 769): erneute Residual-Bewertung ohne erzwungenen Split; bestehende Trennung (`useCredentialsWizardActions.ts`, `useCredentialsWizardUiState.ts`) ist aktuell ausreichend schlank.

- [x] `ResidualHotspotFinalScan` (Patch 769): A1/A2/A3-Residual-Hotspots erneut im engen Scope durchgeprueft; kein weiterer sicherer Mehrwert fuer zusaetzliche Zerlegung ohne neue Regression-/Review-Kosten. Verbleibende groessere Dateien sind bewusst als fachliche Orchestratoren belassen.
- [x] `WeakFallbackHygieneFollowup` (Patch 769): produktnaher Silent-Fallback im GitHub-Repos-Bootstrap entfernt (`AsyncStorage.getItem(...).catch(() => "")` -> explizites `null`-Sentinel + `logger.warn(...)`), ohne Verhaltensaenderung beim leeren/unverfuegbaren EAS-Project-ID-Wert.

- [x] `ScopeTruthfulnessNachzug` (Patch 766): breiter PR-Scope explizit als Mehrfachblock nachgezogen (CI-Lite-Hooks, GitHubRepos UI, EnhancedBuild-Hooks, Preview-Flows, Diagnostics-Checks/FixRunner, Workflow-/Template-Contracts) statt schmaler Teilstory.
- [x] `LiveContractDriftGuardHardening` (Patch 766): `scripts/check_edge_live_contracts.sh` prueft jetzt neben `k1w1-handler`/`preview_page` auch `save_preview` auf Fragment-Transport (`transport=fragment#secret=`) und blockiert Legacy-`?secret=`-Rueckfall explizit fail-closed.
- [x] `ReleaseReadinessToolingRobustness` (Patch 767): `scripts/check_release_readiness.sh` nutzt fuer strict/edge TypeScript jetzt robusten repo-lokalen `tsc`-Aufruf (`./node_modules/.bin/tsc`, fallback `npx tsc`) statt globalem PATH-`tsc`.
- [x] `LiveEdgeVariableSourceDocumentation` (Patch 767): Testing-/Runbook-Doku nennt sichere Quellen fuer `EDGE_BASE_URL`/`EDGE_OPERATOR_JWT` explizit (Runner-Secrets bevorzugt, URL-Fallback via Projekt-Ref `xfgnzpcljsuqqdjlxgul`, JWT nie als Klartext im Repo).

- [x] `GitHubReposDataHookHotspot` (Patch 765): Pull-/Tree-/Blob-Orchestrierung aus `useGitHubRepos.ts` in `useGitHubReposPull.ts` ausgelagert; Hook-Fassade bleibt API-stabil fuer Load/Delete/Rename/Pull/Branches/WorkflowRuns/DefaultBranch.
- [x] `CredentialsWizardHookHotspot` (Patch 765): Action-/Clipboard-/Status-Meta-Orchestrierung aus `useCredentialsWizardScreen.ts` in `useCredentialsWizardActions.ts` getrennt; Auth-/Secret-/Status-Semantik bleibt unveraendert.
- [x] `ChatScreenHookHotspot` (Patch 765): Streaming-/Thinking-/Typing-Animationen aus `useChatScreen.ts` nach `useChatScreenAnimations.ts` extrahiert; Input-/Attachment-/Send-Verhalten unveraendert.
- [x] `EnhancedBuildScreenHookHotspot` (Patch 765): Build-Readiness-/Filter-/Checklist-/Logs-Selection-Derivation in `useEnhancedBuildDerivedState.ts` separiert; Build-/Signing-/Status-Flows bleiben stabil.
- [x] `SecondaryHotspotReview` (Patch 765): Ziel-Dateien (`assetsAndFiles.ts`, `infra/github/workflows.ts`, `GitHubReposScreen/index.tsx`, `useCiLiteWorkflow*`, `usePreview.ts`) erneut gegen direkten Scope-/Regressionseinfluss geprueft; kein zusaetzlicher risikoloser Mini-Fix erzwungen.
- [x] `WorkflowContractFragilityFollowup` (Patch 765): Source-Contract-Marker in den refaktorierten Hook-Fassaden nachgezogen, damit bestehende Invariant-/Release-Checks semantisch gruen bleiben.
- [x] `SoTFollowupAfterRefactors` (Patch 765): fuehrende SoT-Kern-MDs + Checklog/Patchlog auf den echten Abschlussstand der Rest-Hotspots synchronisiert.

- [x] `GitHubReposDataHookHotspot` (Patch 764): `useGitHubRepos` entmischt zwischen Hook-Fassade und dedizierten Request-Helpers (`hooks/useGitHubReposRequests.ts`) fuer Repo-Load/Delete/Rename; Pull-/GraphQL-/Fallback-Semantik und oeffentliche Hook-Shape bleiben stabil.
- [x] `CredentialsWizardHookHotspot` (Patch 764): UI-/Debug-/Error-/Visibility-State aus `useCredentialsWizardScreen` in `useCredentialsWizardUiState.ts` separiert; Auth-/Secret-/Status-Contract bleibt unveraendert.
- [x] `ChatScreenHookHotspot` (Patch 764): Attachment-Picker-Seitenpfad aus `useChatScreen` in `chatScreenDocumentPicker.ts` ausgelagert; Send-/Draft-/Attachment-Truthfulness bleibt unveraendert in der Screen-Fassade.
- [x] `EnhancedBuildScreenHookHotspot` (Patch 764): Build-Action-Orchestrierung (`refreshBuildScreenData`, `persistPreferredBuildProfile`) in `enhancedBuildScreenActions.ts` ausgelagert; Build-/Signing-/Status-Flows bleiben unveraendert.
- [x] `SecondaryHotspotReview` (Patch 764): `assetsAndFiles.ts`, `infra/github/workflows.ts`, `GitHubReposScreen/index.tsx`, `useCiLiteWorkflow*`, `usePreview.ts` erneut bewertet; kein risikoarmer Mini-Fix im direkten Scope erzwungen.
- [x] `WorkflowContractFragilityFollowup` (Patch 764): Folge-Drifts nach Hook-Splits geprueft; Contract-Script bleibt klein nachgezogen und gruen, ohne neuen Systemumbau.
- [x] `SoTFollowupAfterRefactors` (Patch 764): fuehrende SoT-Dokumente und Patch-/Checklog auf den echten Hook-Decomposition-Stand synchronisiert.

- [x] `WorkflowContractFragility` (Patch 763): `scripts/check_workflow_edge_contracts.sh` wurde von unnötig exakten Vollsatz-Markern auf semantische Contract-Marker umgestellt (`require_operator_claim_contract`, Pattern-Buendel statt Copy-exakter Formulierungen), damit inhaltliche RBAC-/Operator-Vertraege weiter hart geprueft werden, aber kleine Text-/Copy-Anpassungen den Gate nicht mehr unnoetig brechen.
- [x] `RefactorSoTDrift` Follow-up (Patch 763): Fuehrende SoT-Dokumente (`README`, `TODO`, `Review`, `INDEX`, `TESTING_GUIDE`, `FRESH_CHECKOUT`, `EDGE_FUNCTIONS_STATUS`, Checklog/Patchlog) auf den aktuellen Stand inkl. Workflow-Contract-Nachzug synchronisiert.
- [x] `ProductConsoleLogHygiene` Nachpruefung (Patch 763): produktiver Runtime-Scope erneut gescannt; kein offensichtlicher direkter `console.log`-Rest ausser der bewusst zentralen Logger-Fassade (`lib/logger.ts`).
- [x] `WorkflowHygieneNarrowFollowup` Bewertung (Patch 763): verbleibende `npm install`-Fallbacks in produktnahen Workflows sind aktuell bewusst fuer Lockfile-/Bootstrap-Fallbacks vorhanden; kein risikoarmer Mini-Fix ohne potenzielle CI-/Onboarding-Regressions wurde erzwungen.

- [x] `BuildPipelineDiagnosticsRefactorFinal` (Patch 761): `lib/diagnostics/buildPipelineDiagnostics.ts` ist jetzt nur noch Orchestrator; Regel-/Profil-/Secret-/Workflow-/ProjectId-Checks und pure Helper liegen in dedizierten Modulen (`buildPipelineDiagnostics.checks.ts`, `.constants.ts`, `.helpers.ts`) ohne semantische Aenderung der bestehenden Severity-/Fix-Vertraege.
- [x] `SharedAuthHotspotFinal` (Patch 761): `supabase/functions/_shared/auth.ts` wurde als stabile Public-Facade beibehalten, waehrend JWT-, Scoped-Guard-, Runtime-Secret-, Admin- und Rate-Limit-Logik in `auth/*` getrennt wurden; fail-closed Auth-/RBAC-/durable-fallback-Verhalten bleibt unveraendert.
- [x] `AppInfoHookRefactorFinal` (Patch 761): `useAppInfoScreen.ts` ist jetzt die duenne UI-Orchestrator-Fassade; API-Config-Import/Export und Secure-Backup-/Secret-Flow wurden in `useAppInfoApiConfigFlow.ts` und `useAppInfoSecureBackupFlow.ts` ausgelagert (inkl. Rollback-/Abort-/Legacy-cleanup-Semantik).
- [x] `LocalRemoteDiffSectionRefactor` (Patch 760): Der Diff-Hotspot ist vollstaendig vom Monolithen in Container, Model, pure Diff-/Fingerprint-Helper, List-UI, Modal-UI und lokale Typen zerlegt; Import-Kompatibilitaet bleibt ueber den schlanken Re-Export erhalten.
- [x] `RefactorSoTDrift` (Patch 760): Fuehrende SoT-Dateien (`README`, `TODO`, `Review`, `INDEX`, `TESTING_GUIDE`, `FRESH_CHECKOUT`, `PROJECT_CHECKLOG`, `PATCHLOG_ROOT`) auf den echten Refactor-Stand synchronisiert; Analyse-only-Header aus Patch 759 sind damit abgeloest.

- [x] Persistenz-Recovery-Guardrails (Patch 746): Kein stilles Re-Keying im Read-/Decrypt-Pfad mehr, kaputte verschluesselte/Plaintext-Payloads fuehren in klaren Recovery-Fehler statt Null/Leerpfad, und Recovery-Mode blockiert normale Hintergrund-/Debounce-Speicherwrites bis zu einer expliziten Nutzeraktion (z. B. Import/Neues Projekt).
- [x] Secret-Import-Haertung (Patch 746): `EAS_PROJECT_ID` wird nur noch gesetzt, wenn der Wert UUID-valide ist; leer fuehrt zu Clear, invalide Werte werden nicht blind geschrieben.
- [x] Preview-Legacy-Removal (Patch 749): Query-Secret-Compat (`?secret=`) und Bridge sind vollstaendig entfernt; Preview akzeptiert Secrets nur noch ueber Fragment-Start + Header-Handoff.
- [x] Writeback-Scope weiter verengt (Patch 748): EAS-Build-Autofix **und** EAS-Link-Writeback erlauben nur noch `work|codex|dev|develop` (kein `main`, keine pauschalen `feature/*`, `hotfix/*`, `release/*`).
- [x] Disabled-Edge-Defaults (Patch 746): deaktivierte Legacy-Functions in `supabase/config.toml` auf `verify_jwt = true` vereinheitlicht (fail-safe Defaults trotz `enabled = false`).
- [x] AppInfo Secret-Import Status-Reset (Patch 745) aus `useAppInfoScreen` in `screens/AppInfoScreen/hooks/secretImportStatusReset.ts` entkoppelt; test-only Export im Hook entfernt und Test auf direkten Helper-Import umgestellt.
- [x] Release-/Workflow-Trust-Drift (Patch 744): `check_workflow_edge_contracts.sh` war lokal reproduzierbar rot wegen fehlendem build_admin-Contract-Marker in `useCiLiteWorkflow.ts`; Marker wurde auf den geforderten Wortlaut nachgezogen und der Gate-Pfad (`check_release_readiness.sh`) anschliessend wieder lokal gruen bestaetigt.
- [x] Manueller `eas-link`-Workflow Writeback gehaertet: read-default auf Workflow-Ebene, job-scoped `contents: write`, plus explizite sichere Branch-Guards (kein SHA/unsafe/detached Ref, kein stilles Push-`|| true`).
- [x] AppInfo-Secret-Hotfixes (Patch 743): API-Config-Export redaktiert API-Keys fail-closed (kein Klartextpfad), API-Config-/Encrypted-Scoped-Backup-Import/Export raeumt temporäre Cache-Dateien idempotent auf, und Secure-Backup exportiert keine unnoetige Token-Duplikation mehr ueber `ciSecrets`.
- [x] `K1W1_ALLOWED_GITHUB_REPOS` fail-closed gemacht (`supabase/functions/_shared/github.ts`): fehlend/leer blockiert jetzt statt default-open.
- [x] `K1W1_ALLOWED_REF_REGEX` fail-closed gemacht in:
  - `supabase/functions/trigger-eas-build/index.ts`
  - `supabase/functions/github-workflow-dispatch/index.ts`
- [x] `actions/upload-artifact` Pins auf konsistenten Full-SHA vereinheitlicht (`ea165f8d65b6e75b540449e92b4886f43607fa02`) in Workflows + Templates.
- [x] Drift in eingebetteten Template-Workflow-Kopien geschlossen (`templates/expo-sdk54-base.json`, `templates/expo-sdk54-full.json` jetzt wieder baseline-aligned zu `.github/workflows/eas-build.yml` und `.github/workflows/release-build.yml`).
- [x] `k1w1-ci-lite-autofix` Workflow-Permissions minimalisiert: unnoetiges `actions: write` entfernt; `contents: write` bleibt fuer guarded Writeback/Dispatch erhalten.
- [x] Lokalen HTML-/Eval-/Babel-/CDN-Fallback in `lib/sandpackBuilder.ts` fuer Production-/Release-Kontext hart deaktiviert (Guard + expliziter Disabled-HTML-Pfad), Dev/Test bleibt explizit nutzbar.
- [x] Preview-Secret-Modell gehaertet (Patch 751): `save_preview` speichert Preview-Secrets nur noch gehasht, `preview_page` nutzt ausschliesslich hash-only Lookup ohne Raw-Secret-Compat-Fallback.
- [x] Preview-Auth-Boundary klein nachgeschaerft (Patch 751): `preview_page` akzeptiert nur GET/HEAD; Secret bleibt Header-basiert (Fragment-Handoff), kein Query-Secret-Revival.
- [x] Preview-Expiry-Cleanup nach Secret-Hashing repariert (Patch 752): Expiry-Delete nutzt denselben hash-only Candidate-Pfad wie der Lookup; es gibt keinen Raw-Secret-Compat-Delete mehr im aktiven Vertrag.
- [x] MaxRuntimeHardening nachgezogen (Patch 753): neue runtime-nahe Tests fuer Preview-Secret-Candidate-Vertrag (`findFirst...`/`delete...`), Release-Execution-Contract bleibt aktiv, und kritische Silent-Catch-Pfade im Preview-/Build-/Upload-/Repo-Meta-Scope wurden auf sichtbares Warn-Logging umgestellt.
- [x] SilentCatchDebt Follow-up (Patch 754): weiterer stummer Catch im PreviewFullscreen-URL-Guard auf sichtbares Warn-Logging umgestellt; Device-ID-Fallback im Diagnostic-Upload dokumentiert jetzt Fehler sichtbar statt still zu schlucken.
- [x] Preview boundary/runtime guard runtime-nah ergaenzt (Patch 754): `isValidPreviewSecretFormat(...)` als shared Runtime-Guard extrahiert und mit ausfuehrbaren Tests gegen missing/invalid/valid Secret-Formate abgesichert.
- [x] DiagnosticUploadSilentCatchMismatch geschlossen (Patch 755): der noch stumme Catch im Persisted-Cooldown-Load (`useDiagnosticUpload`) loggt jetzt sichtbar; neuer Hook-Runtime-Test deckt Persisted-Cooldown- und Device-ID-/RNG-/Persist-Fallback-Warnpfade ausfuehrbar ab.
- [x] DisabledLegacyEdgesRemoval execution-nah nachgeschaerft (Patch 755): neuer Execution-Contract-Test fuer `scripts/check_legacy_disabled_edges.sh` prueft pass/fail-Verhalten in isolierter Fixture statt nur Source-Strings.
- [x] HistoricalChecklogDrift transparent relativiert (Patch 753): `PROJECT_CHECKLOG.md` enthaelt jetzt einen expliziten Hinweis, dass der Checklog append-only Historie und nicht alleinige Release-Wahrheit ist.
- [x] `SUPABASE_RAW`-Persistenz explizit gehaertet: Legacy-Secret-Composite (`url:::key`) wird aktiv verworfen, inkl. Regressionstest.
- [x] Durable rate-limit fallback transparenter gemacht: Fallback-Warnungen markieren jetzt explizit `local_in_memory_best_effort` + `cluster_safe=false`, inkl. Testabdeckung.
- [x] RateLimit-Degradation fuer Preview-Routen geschaerft (Patch 751): `save_preview`/`preview_page` setzen `enforceDurable: true`; bei durable-Ausfall jetzt `503 rate_limit_unavailable` statt lokaler Scheinsicherheit.
- [x] Neue Repo-Migration fuer bestaetigte Live-Befunde vorbereitet (`supabase/migrations/20260403000000_supabase_live_findings_hardening.sql`) — fail-closed Re-Assertion fuer `build_jobs`, Legacy-Haertung fuer `cleanup_old_previews(integer)` und explizite deny-Policies fuer `signing_audit_log` (ohne Live-Mutation).


- [x] DocsSyncGap (Patch 758): `check_patch_docs_sync.sh` prueft jetzt den echten Kern-SoT-Scope (README/CHECKLOG/PATCHLOG + TODO/Review/INDEX/TESTING_GUIDE/FRESH_CHECKOUT/EDGE_FUNCTIONS_STATUS) auf denselben Patch-Stand.
- [x] LegacyCryptoSurface (Patch 758): Legacy-SHA/AES-CBC-Helfer sind explizit als read-only Compat benannt; neue Writes bleiben strikt auf v3 (PBKDF2 + AES-GCM).
- [x] PreviewEvalTradeoff (Patch 758): Tradeoff bleibt bewusst bestehen (`unsafe-eval`, `https://esm.sh`), aber Flags/Kommentare/Status sind konsistent und klar abschaltbar dokumentiert.
- [x] SilentCatchLeftovers (Patch 758): verbleibende stille Catchs in `WebCodeEditor` und `ConfirmChangesModal` melden jetzt sichtbare Warnungen ohne den Fail-safe Ablauf zu brechen.
- [x] ReleasePartial (Patch 758): Release-SoT bleibt explizit getrennt (`OK_WITH_SKIPS` = partial/local evidence, `OK_FULL` = Vollnachweis).

## 2) Externer Live-Status: ehrliche Restpunktbewertung (read-only dokumentiert)

### Build-Admin-Governance (Owner / Rotation / Freigabeprozess)

- Primaeres Runbook: `docs/runbooks/OPERATOR_SETUP_CHECKLIST.md` (Owner/Rotation/Freigabe).
- Owner-Rolle muss benannt sein (mindestens 1 Primary + 1 Backup), Rotationsturnus und Freigabeprozess fuer `build_admin` muessen explizit dokumentiert werden.
- Ohne dokumentierten Owner/Rotation/Freigabe bleibt ein Release-Blocker fuer operatorische Build-/Workflow-Pfade bestehen.


### Externe Betriebs-Restpunkte (bewusst ausserhalb Repo-Code)

Legacy-Contract-Marker: **Supabase-/Operator-Runbook-Restpunkt geschlossen** (historischer Marker; kein offener privilegierter Testzustand aus dem bereinigten Test-User).

### Kritisch offen

- Kein aktuell bekannter technischer High-Priority-Restpunkt; der fruehere `preview_page`-Legacy-Drift (`Missing ?secret=...`) wurde per Redeploy (`preview_page` + `save_preview`) geschlossen und im SoT als erledigt markiert.

### Bewusst offen / Produktentscheidung

- `diagnostics_reports`: bleibt bewusst offene Produktentscheidung (A/B), kein Blindumbau.
- Referenz: Decision-Note 2026-04-03 (`docs/reviews/diagnostics_reports_policy_decision_2026-04-03.md`).

### Niedrige Prioritaet / Hygiene

- Temporaerer Test-User `h91874350@gmail.com` / `BlauBeerToni84` wurde operativ bereinigt; daraus bleibt kein privilegierter Testzustand offen.
- Optionale spaetere Hygiene: Trigger-/Hook-Funktionen ohne `search_path` punktuell live querpruefen.
- Follow-up-Migration fuer Suchpfad-Reassertion bereits vorbereitet: `20260403010000_search_path_followup.sql`.
- Optionale Plattformhygiene: Leaked Password Protection + Duplicate Indexes separat behandeln.

## 3) Offen: Repo-Haertungen/Hygiene fuer spaeter (bewusst nicht in diesem kleinen Lauf)

1. verify_jwt-Flag-Drift frueher sichtbar machen (aktueller Flag-Audit fuer `save_preview`/`k1w1-handler` ist erledigt; als kuenftige Betriebshygiene bleibt ein expliziter Re-Check pro Release sinnvoll)
2. SilentCatchHygiene: produktnahe Pfade erneut gescannt (Patch 762) — keine verbleibenden stillen `.catch(() => {})` / `catch {}` im produktiven Runtime-Scope gefunden; nur Dokumentationsbeispiele enthalten den Pattern-Text
3. Workflow-Hygiene-Nachzug nur mit engem Scope:
   - verbleibende `npm install`-Fallbacks in produktnahen Pfaden weiter reduzieren, **nur** wenn lockfile-/bootstrap-sichere Alternative ohne CI-Onboarding-Risiko vorliegt
   - Repo-Writebacks/persisted Credentials weiter punktuell pruefen; CI-Lite-Autofix-Permission-Scope ist bereits auf `contents: write` reduziert

## 4) Benötigte externe Infos / Zugänge / Admin-Aktionen

- Supabase-Dashboard-/Admin-Zugriff (oder benannte verantwortliche Person mit diesem Zugriff).
- Berechtigung/Prozess, Edge Functions live zu deployen und `Require JWT` je Function sicher zu verifizieren/setzen.
- Berechtigung, produktive SQL-Migrationen auf Supabase auszufuehren.
- Verfuegbarkeit/Setzung folgender Secrets/Variablen in den Zielumgebungen:
  - `K1W1_EDGE_WORKFLOW_ADMIN_KEY`
  - `K1W1_ALLOWED_GITHUB_REPOS`
  - `K1W1_ALLOWED_REF_REGEX`
  - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
  - `PREVIEW_SUPABASE_URL` / `PREVIEW_SERVICE_ROLE_KEY`
  - `GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_API_TOKEN`
  - `SIGNING_ADMIN_KEY`
  - `SIGNING_MASTER_KEY`
- Moeglichkeit, gueltigen Operator-/Admin-JWT fuer Live-Contract-Tests zu erhalten.
- Klaerung, wie/wo `build_admin` extern provisioniert wird (Owner, Prozess, Rotation).
- Benennung, welches Team/System die realen Supabase-Live-Deployments durchfuehrt.

## 5) Hinweis zur frueheren Aussage

Die fruehere Pauschalaussage **"keine offenen Repo-Muss-Punkte"** war nach dem aktuellen Befund nicht mehr haltbar und wurde entsprechend korrigiert.

## Verbindliche Begleitquellen

- `docs/reviews/Review.md`
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`
