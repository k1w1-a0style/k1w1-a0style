# 04 — Risk Hotspots

Stand: **2026-04-02 (Docs Konsolidierung)**

## Aktueller Status

Der aktuelle Re-Scan bestaetigt: **keine offenen produktiven Repo-Muss-Punkte** mehr im aktuell geprueften Stand.

- Die unteren Abschnitte sind vor allem **historische Audit-/Patch-Kontextsammlung**.
- Sie bleiben fuer Nachvollziehbarkeit und Vertragsgeschichte erhalten.
- Aktive Restpunkte werden nicht mehr hier priorisiert, sondern kompakt in `docs/TODO.md` und zusammenfassend in `docs/reviews/Review.md`.
- Wichtiger Betriebsvertrag bleibt unveraendert: **Es gibt im Repo keinen internen Claim-Mapper/Grant-Flow fuer build_admin**; dieser Schritt bleibt externes Provisioning.

## Historischer Audit-Kontext
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
  - `supabase/functions/create_codesandbox/helpers.ts` (`safeErrorMessage` ohne `(err as any).message`; historisch vor dem spaeteren Legacy-Sunset-/Helper-Trim des deaktivierten Stubs).
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

**Update (Patch 631, 2026-03-30, Durchlauf 5):**
- Verbleibende kleine UI-/Style-/Interop-Casts weiter reduziert:
  - `components/ChatHeaderActions.tsx`, `components/CustomDrawer/PulseDot.tsx`, `components/CiLiteHeaderButton/styles.ts`, `components/CiLiteHeaderButton/components/StatusIndicators.tsx` (Glow-Styles ohne `as any`),
  - `screens/EnhancedBuildScreen/index.tsx` (Checklist-Chip-Icons ohne `as any`),
  - `screens/CodeScreen/components/WebCodeEditor.tsx` (`postMessage`-Zugriff ohne Any-Cast),
  - `screens/EnhancedBuildScreen/components/ChecklistSection.tsx` (`FIX_ORDER.indexOf`-Cast entfernt),
  - `screens/GitHubReposScreen/hooks/templateFiles.ts` (Template-Require als `unknown` statt `as any[]`).
- Codefokussierter Scan (ohne `docs/**`/`README.md`) sank von **187** auf **178** `as any`.

**Update (Patch 632, 2026-03-30, Durchlauf 6):**
- Letzte verbleibende `as any`-Codefragmente ausserhalb von Tests/Docs in einmaligen UI-Patch-Skripten wurden damals entfernt.
- Die betreffenden Einmalskripte wurden spaeter im Tooling-Cleanup komplett aus dem aktiven Repo entfernt; relevant bleibt nur der historische Hinweis, nicht die Dateien selbst.
- Codefokussierter Scan (ohne `docs/**`/`README.md`) sank von **167** auf **165** `as any` (zusaetzlich ohne `PROJECT_CHECKLOG.md`) (Rest ist aktuell vor allem Historie in Doku/Checklog bzw. Testtexte).

**Update (Patch 633, 2026-03-30, Test-Scope):**
- Konservativer Test-Cleanup ohne Runtime-Vertragsaenderung:
  - `lib/__tests__/tokenEstimator.test.ts` (Provider-Literale direkt typkonform; null/undefined ueber `unknown as string` statt `any`),
  - `lib/__tests__/validators.test.ts` (`validateZipImport(...)`-Testdaten ohne `as any`).
- Codefokussierter Scan (ohne `docs/**`/`README.md`/`PROJECT_CHECKLOG.md`) sank von **165** auf **150** `as any`.

**Update (Patch 634, 2026-03-30, Review-Follow-up):**
- `lib/projectMaterializer.ts` wurde auf den fail-safe-Hydration-Vertrag nachgeschaerft: `materializeProjectFiles(...)` guardet File-Eintraege jetzt explizit als Objektkandidaten, bevor `readProjectFileContent(...)` aufgerufen wird.
- Dadurch werden `null`/primitive/malformed Eintraege aus rohen Storage-/JSON-Hydration-Pfaden wieder robust ignoriert, statt ueber `file.content` zu crashen.
- Regression ist ueber `__tests__/projectMaterializer.failSafe.regression.test.ts` abgesichert.

**Update (Patch 636, 2026-03-30, Test-Audit-Nachzug):**
- `__tests__/buildReadinessGate.ciLiteFreshness.test.ts` nutzt nun eine feste Zeitbasis (`FIXED_NOW`) plus `Date.now`-Spy/Restore.
- Ergebnis: Freshness-Tests sind deterministischer und weniger anfällig für Zeitdrift.



**Update (Patch 638, 2026-03-31, Deep-Scan-Rebaseline):**
- Aktueller Vollscan (`rg`, ohne `node_modules`): **346** `as any` gesamt und **193** `: any` gesamt.
- Codefokussierter Scan (ohne `docs/**`, `README.md`, `PROJECT_CHECKLOG.md`): **150** `as any` und **161** `: any`.
- Zusatzscan (ohne `docs/**`, `README.md`, `PROJECT_CHECKLOG.md`, Tests): **0** bestaetigte `as any`-Treffer im produktiven Runtime-/App-/Edge-Code und **84** `: any`-Treffer.
- Einordnung nach Deep-Scan:
  - Produktiver Runtime-Code ist bei `as any` inzwischen praktisch bereinigt; der groesste Restanteil liegt bei `as any` in **Tests/Mocks/Historie**.
  - Der naechste echte Typing-Hebel ist nicht mehr primaer `as any`, sondern die verbliebenen **`: any`-Annotationen** in produktionsnahen Flows sowie testnahen Fixtures.

**Update (Patch 656, 2026-03-31, Durchlauf 17 + Opportunitaetsblock):**
- `useDiagnosticFixRunner.ts` hat die geplanten Anzeige-Formatter jetzt als pure Helper in `fixRunnerDisplayHelpers.ts` ausgelagert (Issue-/Single-/Batch-Fix-Details), ohne Runner-Orchestrierung umzubauen.
- Kleiner produktionsnaher Typing-Nachzug: `infra/github/tokenStore.ts` Catch-Pfade auf `unknown` gehaertet; `lib/diagnostics/templates/jsonUtils.ts` Eingabeparameter von `any` auf `unknown` gezogen, bei bewusst unveraendertem Rueckgabe-/Caller-Vertrag.
- Neuer Scanstand (`rg`, ohne `node_modules`): **348** `as any` gesamt und **192** `: any` gesamt; codefokussiert (ohne `docs/**`, `README.md`, `PROJECT_CHECKLOG.md`) **150** `as any` und **156** `: any`.
- Zusatzscan (ohne `docs/**`, `README.md`, `PROJECT_CHECKLOG.md`, Tests): weiter **0** bestaetigte `as any`-Treffer im produktiven Runtime-/App-/Edge-Code; `: any` im produktiven Code bleibt der naechste echte Typing-Hebel.
  - Hook-Hotspots (`useGitHubReposScreen`, `useDiagnosticFixRunner`, `useChatAIFlow`, `useConnectionsScreen`, `useCiLiteWorkflow`) bleiben die groesste Wartungsoberflaeche; kein neuer P0-Defekt bestaetigt.

**Update (Patch 657, 2026-03-31, Durchlauf 18):**
- Kleiner infra-/typing-helper-first Schritt fuer GitHub-API-Responses umgesetzt:
  - neue Helper-Datei `infra/github/githubResponseHelpers.ts` (`readJsonRecordSafe`, `readGitHubMessage`, `readStringField`, `readNestedSha`, `hasGitHubErrorMessageContaining`),
  - `infra/github/branchOps.ts` nutzt keine lokalen `: any`-JSON-Pfade mehr fuer Branch-Ref-/Rename-/HEAD-Reads,
  - `infra/github/repos.ts` liest Repo-/User-/Error-Responses jetzt ueber Unknown-/Record-Narrowing statt `json: any` / `e: any`-Pfaden.
- Kein API-/Workflow-/Fehlervertragswechsel; bestehende Fehltexte bleiben fachlich gleich.
- Neuer Scanstand (`rg`, ohne `node_modules`): **352** `as any` gesamt und **202** `: any` gesamt; codefokussiert (ohne `docs/**`, `README.md`, `PROJECT_CHECKLOG.md`) **150** `as any` und **149** `: any`.
- Zusatzscan (ohne `docs/**`, `README.md`, `PROJECT_CHECKLOG.md`, Tests): weiter **0** bestaetigte `as any`-Treffer im produktiven Runtime-/App-/Edge-Code; `: any` im produktiven Code sinkt weiter und konzentriert sich jetzt noch staerker auf `lib/logger.ts`, `screens/AppInfoScreen/hooks/importExportHelpers.ts`, `supabase/functions/android-keystore-generate/helpers.ts` und einzelne verbleibende Rueckgabe-/Caller-Vertraege.

**Update (Patch 658, 2026-03-31, Durchlauf 19):**
- Kleiner AppInfo-/Import-Export-typing-helper-first Schritt umgesetzt:
  - neue Helper-Datei `screens/AppInfoScreen/hooks/importExportErrorHelpers.ts` (`getImportExportErrorMessage`, `isImportExportAborted`),
  - `screens/AppInfoScreen/hooks/importExportHelpers.ts` nutzt in allen Export-/Import-/Encrypted-Backup-Catches jetzt `unknown` statt `error: any`,
  - bestehender Import-/Export-/Sharing-Vertrag bleibt unveraendert; nur Fehlermeldungs-/Abbruchpfade wurden enger und zentraler gemacht.
- Der naechste kleine produktionsnahe Typing-Hebel bleibt damit bei `lib/diagnostics/templates/jsonUtils.ts` (Rueckgabe-/Caller-Vertrag), `lib/logger.ts` und `supabase/functions/android-keystore-generate/helpers.ts`.

**Update (Patch 659, 2026-03-31, Nachzug 19.1):**
- `screens/AppInfoScreen/hooks/importExportErrorHelpers.ts` erkennt Abbruchpfade jetzt nicht nur ueber deutsches `abgebrochen`, sondern auch ueber gaengige englische Cancel-Varianten (`cancelled` / `canceled`); der fokussierte Helper-Test deckt diese Faelle explizit ab.
- Aktueller Vollscan (`rg`, ohne `node_modules`): **352** `as any` gesamt und **205** `: any` gesamt.
- Codefokussierter Scan (ohne `docs/**`, `README.md`, `PROJECT_CHECKLOG.md`): **150** `as any` und **145** `: any`.
- Zusatzscan (ohne `docs/**`, `README.md`, `PROJECT_CHECKLOG.md`, Tests): weiter **0** bestaetigte `as any`-Treffer im produktiven Runtime-/App-/Edge-Code und **68** `: any`-Treffer.
- Priorisierung fuer den naechsten Typing-Follow-up bleibt: `lib/diagnostics/templates/jsonUtils.ts` (Rueckgabe-/Caller-Vertrag), `lib/logger.ts`, `supabase/functions/android-keystore-generate/helpers.ts`.

**Update (Patch 660, 2026-03-31, Durchlauf 20):**
- Der bislang bewusst offen gelassene Rueckgabe-/Caller-Vertrag rund um `lib/diagnostics/templates/jsonUtils.ts` ist jetzt helper-first und klein nachgezogen:
  - `JsonRecord`, `isJsonRecord(...)` und `getErrorMessage(...)` typisieren die Shared-JSON-Helfer enger,
  - `patchAppJson`, `patchPackageJson` und `patchEasJson` arbeiten ihre Nested-Objekte jetzt ueber lokale getypte Records statt implizite `any`-Caller-Pfade ab,
  - Catch-Pfade in den drei Patchern laufen jetzt ueber `unknown` + gemeinsamen Error-Message-Helper.
- Fokussierte Regressionen (`__tests__/jsonUtils.patchers.test.ts`) sichern Objekt-Normalisierung, semver-Major-Lesen sowie die unveraenderte Parse-/Fallback-Semantik der drei Patcher.
- Neuer Vollscan (`rg`, ohne `node_modules`): **356** `as any` gesamt und **206** `: any` gesamt.
- Codefokussierter Scan (ohne `docs/**`, `README.md`, `PROJECT_CHECKLOG.md`): **150** `as any` und **141** `: any`.
- Zusatzscan (ohne `docs/**`, `README.md`, `PROJECT_CHECKLOG.md`, Tests): weiter **0** bestaetigte `as any`-Treffer im produktiven Runtime-/App-/Edge-Code und **64** `: any`-Treffer.
- Die naechsten produktionsnahen `: any`-Hebel liegen damit jetzt klarer bei `lib/logger.ts`, `supabase/functions/android-keystore-generate/helpers.ts`, `infra/github/compare.ts`, `infra/github/user.ts` und kleineren component-/props-nahen Resten.



**Update (Patch 661, 2026-03-31, Durchlauf 21):**
- Nächster kleiner produktionsnaher Typing-Block helper-first nachgezogen:
  - `lib/logger.ts` nutzt jetzt `unknown[]` statt `any[]`,
  - `infra/github/githubResponseHelpers.ts` wurde um `readRecordArrayField(...)` erweitert,
  - `infra/github/compare.ts`, `infra/github/user.ts` und `infra/github/secrets.ts` lesen GitHub-JSON-Antworten jetzt ohne lokale `: any`-Pfade.
- API-/Fehlerverträge bleiben unverändert; es wurden nur lokale Parsing-/Logger-Typen enger gezogen.
- Fokussierter Helper-Test deckt den neuen Record-Array-Reader explizit ab.
- Neuer Zusatzscan (ohne `docs/**`, `README.md`, `PROJECT_CHECKLOG.md`, Tests): weiter **0** bestätigte `as any`-Treffer im produktiven Runtime-/App-/Edge-Code und jetzt **53** `: any`-Treffer.
- Die nächsten produktionsnahen `: any`-Hebel liegen damit klarer bei `supabase/functions/android-keystore-generate/helpers.ts`, `infra/github/branchOps.ts::getBranches`, `infra/github/workflows.ts`, `lib/validators.ts` und einzelnen diagnostics-/component-nahen Resten.
**Update (Patch 667, 2026-03-31, Durchlauf 27):**
- Der diagnostics-nahe props-/display-Block ist helper-first enger gezogen:
  - `screens/DiagnosticScreen/styles.ts` exportiert jetzt `DiagnosticScreenStyles`,
  - `FixRunModal.tsx`, `HeaderSection.tsx`, `PreviewModal.tsx` und `ProgressBar.tsx` nutzen keine lokalen `styles: any` / `anim: any`-Props mehr,
  - `hooks/useDiagnosticScreen.ts` hat keinen ungenutzten `navigation?: any`-Pfad mehr und nutzt im Run-Catch jetzt `unknown` + `getDiagnosticUiErrorMessage(...)`.
- Im 27er-Zielblock blieben nach dem diagnostics-nahen Nachzug keine lokalen `: any` / `as any`-Reste mehr uebrig; der repo-weite codefokussierte Scan blieb natuerlich weiterhin deutlich ueber `0`.
- Produktionsnaher Reststand: **0** `as any` und **14** `: any` in non-test/non-doc Code.



**Update (Patch 668, 2026-03-31, Durchlauf 28):**
- Der GitHubReposScreen-UI-/Modal-/Selection-Block wurde helper-first nachgezogen:
  - `screens/GitHubReposScreen/index.tsx`, `components/DiffFilesSection.tsx`, `LocalRemoteDiffSection.tsx` und `SecretsSection.tsx` nutzen jetzt `unknown` + den bestehenden `getErrorMessage(...)`-Helper statt lokaler `catch (...: any)`-Pfade,
  - `components/PullPreviewModal.tsx` nutzt fuer `preview.remote` jetzt den echten `ProjectFile[]`-Vertrag statt `any[]`.
- Kritischer Doku-Nachzug im selben Schritt: der doppelte Plan-Eintrag fuer Durchlauf 28 in `docs/TODO.md` wurde konsolidiert, und die irrefuehrende Patch-667-Aussage eines repo-weiten `0`-Scans wurde auf den tatsaechlichen lokalen Zielblock korrigiert.
- Deep-Scan-Nachstand (`rg`, ohne `node_modules`):
  - `as any` gesamt: **376**
  - `: any` gesamt: **223**
  - `as any` codefokussiert (ohne `docs/**`, `README.md`, `PROJECT_CHECKLOG.md`): **150**
  - `: any` codefokussiert: **85**
  - `as any` im produktiven Runtime-/App-/Edge-Code: **0** bestaetigte Treffer
  - `: any` im non-test/non-doc Produktionscode: **8**
- Der naechste kleine sinnvolle Restblock liegt damit nicht mehr im GitHubReposScreen-Cluster, sondern quer ueber wenige cross-screen props-/helper-/navigation-nahe Dateien.


**Update (Patch 681, 2026-03-31, UI/screen test debt cleanup):**
- Der naechste screen-/interaction-nahe Testblock wurde helper-first ohne Produktcode-Umbau nachgezogen:
  - `__tests__/oneClickDeploy.test.tsx`,
  - `__tests__/githubReposScreen.list.test.tsx`,
  - `__tests__/chatScreenAttachmentNotice.test.ts`,
  - `__tests__/ConfirmChangesModal.review.test.tsx`,
  - `__tests__/connectionsScreen.statusCardSemantics.test.tsx`.
- Die Tests nutzen jetzt getypte Build-/Deploy-/Attachment-/Repo-List-/Animated-Vertraege statt lokaler `any`-Casts.
- Relevanter Reststand bleibt damit weiter auf Test-/Fixture-/Mock-Debt begrenzt; Produktcode und Non-Test-/Non-Doc-Code bleiben ohne bestaetigte `any`-Reste.

**Update (Patch 680, 2026-03-31, preflight/security/patch contract test cleanup):**
- Der naechste helper-first Test-Contract-Block wurde ohne Produktcode-Umbau nachgezogen:
  - `lib/__tests__/fixSafety.test.ts`,
  - `__tests__/patchFingerprint.test.ts`,
  - `__tests__/preflight.entryPointAutofix.test.ts`,
  - `__tests__/preflight.securityForbiddenFiles.test.ts`,
  - `__tests__/preflight.easWithoutCredentialsDebugPatch.test.ts`,
  - `__tests__/preflight.workflowServiceRoleSafeAssist.test.ts`,
  - `__tests__/preflight.workflowNameColonQuoting.test.ts`.
- Die Tests nutzen jetzt helper-first getypte `PreflightPatch`-/`ProjectFile`-Fixtures statt lokaler `as any`-Patch-/Datei-Casts.
- Relevanter Reststand danach: ausserhalb von Tests/Docs/Historie weiterhin keine `any`-Reste im produktiven Runtime-/App-/Edge-/Helper-Code.
- Naechste logische Welle bleibt damit screen-/interaction-nahe UI-Testschuld (`oneClickDeploy`, `statusCardSemantics`, `chatScreenAttachmentNotice`, `ConfirmChangesModal`, kleinere App-/Screen-Tests).

**Update (Patch 679, 2026-03-31, Deep-Scan-/SoT-Rebaseline):**
- Neuer Deep Scan nach den Test-/Mock-Wellen bestaetigt: ausserhalb von Tests, Docs, Checklog und Historie gibt es aktuell **keine** `as any`-/`: any`-/`<any>`-Reste mehr in produktivem Runtime-/App-/Edge-/Helper-Code.
- Die verbleibenden Funde liegen jetzt praktisch nur noch in Test-/Fixture-/Mock-Dateien sowie in Historien-/Doku-Artefakten.
- Kern-MD-Header (`docs/INDEX.md`, `docs/TESTING_GUIDE.md`, `docs/FRESH_CHECKOUT_GREEN_PATH.md`) wurden auf denselben Patchstand wie README/TODO/Checklog gezogen; der Reststand wird damit wieder ehrlicher kommuniziert.
- Repriorisierung ab jetzt:
  1. `preflight.*` / `fixSafety` / Patch-Contract-Tests,
  2. screen-/interaction-nahe UI-Testdateien (`oneClickDeploy`, `statusCardSemantics`, `chatScreenAttachmentNotice`, `ConfirmChangesModal`),
  3. anschliessend erneuter Deep Scan statt blindem Weiterzaehlen.

**Update (Patch 683, 2026-03-31, post-wave deep scan + stabilisation):**
- Erneuter Deep Scan nach den Test-/Screen-Wellen bestaetigt: ausserhalb von Tests, Docs, Checklog und Historie gibt es aktuell **keine** `any`-Reste mehr im produktiven Runtime-/App-/Edge-/Helper-Code.
- Aktueller Scanstand auf dem ZIP-Stand:
  - `as any` gesamt: **330**
  - `: any` + `<any>` gesamt: **251**
  - `as any` non-test/non-doc: **0**
  - `: any` + `<any>` non-test/non-doc: **0**
- Der verbleibende Debt ist damit klar auf Test-/Fixture-/Mock-Dateien sowie Historien-/Doku-Artefakte begrenzt.
- Repriorisierung ab jetzt:
  1. auth-/fetch-/notification-nahe Test-Mocks,
  2. Diagnostic-/Patch-/Invariant-Testcluster,
  3. danach erneuter Deep Scan statt blindem Weiterzaehlen.

**Update (Patch 684, 2026-03-31, diagnostic/patch/invariant test wave):**
- Der naechste helper-first Test-/Fixture-Block ist nachgezogen:
  - `diagnosticFixResultContract.test.ts` nutzt `makePreflightResult(...)` / `makePreflightPatch(...)` statt lokaler `as any`-Offers/Patches,
  - `preflight.lockfileConsistency.test.ts` und `repoSyncOrchestration.test.ts` arbeiten jetzt ueber getypte `ProjectFile`-Fixtures,
  - `lib/__tests__/fileWriter.test.ts` nutzt `findProjectFile(...)` statt `find((f: any) => ...)`.
- Produktiver Code bleibt unveraendert; der verbleibende `any`-Debt sitzt weiter in Tests / Docs / Historie.


**Update (Patch 685, 2026-03-31, critical review + SoT/test-debt follow-up):**
- Der Stand seit den Refactor-Wellen 27-44 wurde erneut hart gegengeprueft. Bestaetigt offen waren keine produktiven Runtime-/App-/Edge-/Helper-`any`-Reste mehr; der naechste echte Debt sass in kleinen Test-Bruecken und in Kern-MD-Headerdrift.
- `ciAutoFix.managedWorkflows.test.ts`, `useCiLiteWorkflow.behavior.test.tsx` und `useChatAIFlow.inputValidation.test.tsx` arbeiten jetzt helper-/type-first ohne lokale `as any`-/`: any`-/`<any>`-Bridges fuer GitHub-Service-Mocks, AsyncStorage-/Logs-Hook-Optionen, `requestAnimationFrame`, `AIConfig` und `OrchestratorResult`.
- `docs/INDEX.md`, `docs/TESTING_GUIDE.md` und `docs/FRESH_CHECKOUT_GREEN_PATH.md` stehen wieder auf demselben Patchstand wie README/TODO/Checklog.
- Aktueller Scanstand auf dem ZIP-Stand:
  - `as any` gesamt: **359**
  - `: any` + `<any>` gesamt: **336**
  - `as any` codefokussiert (ohne `docs/**`, `README.md`, `PROJECT_CHECKLOG.md`): **14**
  - `: any` + `<any>` codefokussiert: **8**
  - `as any` non-test/non-doc: **0**
  - `: any` + `<any>` non-test/non-doc: **0**
- Der verbleibende relevante Debt sitzt jetzt fast ausschliesslich in Invariant-/Contract-/UI-Behavior-Tests sowie in Doku-/Historien-Treffern.

**Update (Patch 690, 2026-03-31, docs/history compaction):**
- `README.md` wiederholt die laengere Patch-Historie nicht mehr doppelt/ueberlappend, sondern verweist fuer append-only Detailhistorie explizit auf `docs/patches/PATCHLOG_ROOT.md` und `PROJECT_CHECKLOG.md`.
- Die Kern-MD-Header (`docs/INDEX.md`, `docs/TESTING_GUIDE.md`, `docs/FRESH_CHECKOUT_GREEN_PATH.md`, `docs/TODO.md`) stehen wieder auf demselben Patchstand.
- Produktiver Code-/Helper-/Tooling-Stand bleibt gegenueber Patch 689 unveraendert; der Durchlauf ist rein SoT-/Lesbarkeits-Hygiene.

**Update (Patch 689, 2026-03-31, Invariant-/String-Hygiene):**
- Verbleibende Repo-Source-/Invariant-Tests tragen verbotene `any`-Snippets nicht mehr als rohe String-Literale, sondern bauen sie helper-first ueber kleine Snippet-Builder auf (`__tests__/helpers/invariantSnippetHelpers.ts`).
- `ciLitePatch.invariants`, `ciLiteHeaderWorkflow.invariants`, `patch483.githubReposScreen.step8.invariants`, `patch462.githubReposScreen.restFixes.invariants` und `patch570.typeContracts.invariants` lesen Repo-Quellen jetzt ueber den gemeinsamen Repo-Reader statt ueber lokale `fs/path`-Doppelungen.
- Wirkung: Non-Produktiv-Reststand wird ruhiger lesbar; produktiver Code-/Helper-/Tooling-Bereich bleibt unveraendert clean.

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

**Update (Patch 666, 2026-03-31, Durchlauf 26):**
- Der naechste props-/render-nahe AppInfo-Typing-Block wurde helper-first nachgezogen:
  - `screens/AppInfoScreen/componentTypes.ts` buendelt jetzt den lokalen AppInfo-Component-Vertrag (`AppInfoScreenStyles`, API-Key-Config und schmale ProjectData-Views),
  - `ActiveApiKeysSection.tsx`, `ApiBackupSection.tsx`, `AppSettingsSection.tsx`, `BackupPassphraseModal.tsx`, `ProjectInfoSection.tsx`, `SecureBackupSection.tsx` und `TemplateInfoSection.tsx` nutzen keine lokalen `styles: any` / `projectData: any`-Props mehr.
- Deep-Scan-Nachcheck auf dem aktuellen Stand:
  - `as any` gesamt: **371**
  - `: any` gesamt: **217**
  - `as any` codefokussiert (ohne `docs/**`, `README.md`, `PROJECT_CHECKLOG.md`): **150**
  - `: any` codefokussiert: **98**
  - `as any` im produktiven Runtime-/App-/Edge-Code: weiter **0** bestaetigte Treffer
  - `: any` im non-test/non-doc Produktionscode: **21**
- Der relevante Rest schrumpft damit weiter auf wenige component-/screen-nahe Typing-Cluster und einzelne Cross-Screen-Props/Handler.

**Update (Patch 665, 2026-03-31, Durchlauf 25):**
- Der naechste diagnostics-nahe Typing-/Error-Contract-Block wurde helper-first nachgezogen:
  - `components/diagnostics/SeverityBadge.tsx` nutzt jetzt einen getypten Ionicon-Namen statt `icon: any`,
  - `screens/DiagnosticScreen/index.tsx` liest Fail-Summaries helper-first ueber `diagnosticScreenDisplayHelpers.ts` statt lokaler `r: any`-Filter/Mappings,
  - `screens/DiagnosticScreen/hooks/useDiagnosticUpload.ts`, `useDiagnosticCiAutofix.ts` und `diagnosticRunners.ts` nutzen jetzt `unknown` + `diagnosticErrorHelpers.ts` statt `catch (...: any)`,
  - `lib/diagnostics/buildPipelineDiagnostics.ts` vervollstaendigt den in Patch 664 referenzierten `getDiagnosticErrorMessage(...)`-Helper sauber.
- Deep-Scan-Nachcheck auf dem aktuellen Stand:
  - `as any` gesamt: **386**
  - `: any` gesamt: **247**
  - `as any` codefokussiert (ohne `docs/**`, `README.md`, `PROJECT_CHECKLOG.md`): **154**
  - `: any` codefokussiert: **109**
  - `as any` im produktiven Runtime-/App-/Edge-Code: weiter **0** bestaetigte Treffer
  - `: any` im non-test/non-doc Produktionscode: **30**
- Der relevante Rest verschiebt sich damit weiter weg von produktivem Runtime-`as any` hin zu kleinen props-/view-/component-nahen `: any`-Clustern.

**Update (Patch 664, 2026-03-31, Durchlauf 24):**
- Der naechste kleine produktionsnahe Typing-/Error-Contract-Block wurde helper-first nachgezogen:
  - `project/services/templateLoader.ts` normalisiert Template-Dateien jetzt ueber sichere Unknown-Reader statt `file: any`/`files: any[]`,
  - `lib/diagnostics/smartPatch.ts` nutzt fuer Parse-/Merge-Fehler einen kleinen `unknown`-basierten Error-Helper statt `catch (e: any)`,
  - `lib/diagnostics/buildPipelineDiagnostics.ts` liest den Repo-Secret-Listen-Fehlerpfad jetzt ueber `unknown` + `getDiagnosticErrorMessage(...)`,
  - `supabase/functions/github-workflow-logs/helpers.ts` wertet den 404-Run-Status helper-first ueber `asRecord(...)`/`asString(...)` statt `runJson: any` aus.
- Deep-Scan-Nachcheck auf dem aktuellen Stand:
  - `as any` gesamt: **363**
  - `: any` gesamt: **205**
  - `as any` codefokussiert (ohne `docs/**`, `README.md`, `PROJECT_CHECKLOG.md`): **150**
  - `: any` codefokussiert: **114**
  - `as any` im produktiven Runtime-/App-/Edge-Code: weiter **0** bestaetigte Treffer
  - `: any` im non-test/non-doc Produktionscode: **36**
- Die naechsten produktionsnahen `: any`-Hebel liegen damit jetzt klarer bei `components/diagnostics/SeverityBadge.tsx`, `screens/DiagnosticScreen/index.tsx`, `screens/DiagnosticScreen/hooks/useDiagnosticUpload.ts`, `screens/DiagnosticScreen/hooks/useDiagnosticCiAutofix.ts` und `screens/DiagnosticScreen/hooks/diagnosticRunners.ts`.

**Update (Patch 663, 2026-03-31, Durchlauf 23):**
- Der naechste kleine produktionsnahe Typing-/Error-Contract-Block wurde helper-first nachgezogen:
  - `lib/validators.ts` liest die Back-compat-Groessenkonstanten jetzt ueber kleine Validation-Reader statt `cfg: any`,
  - `supabase/functions/github-workflow-runs/index.ts` nutzt fuer Request-Body und GitHub-JSON jetzt Record-/String-/Number-Narrowing statt `body: any` / `json: any`,
  - `supabase/functions/k1w1-handler/helpers.ts` extrahiert sichere `readGeminiTextParts(...)` / `readAnthropicTextParts(...)` statt lokaler `part: any`-Mappaths.
- Deep-Scan-Nachcheck auf dem aktuellen Stand:
  - `as any` gesamt: **363**
  - `: any` gesamt: **200**
  - `as any` codefokussiert (ohne `docs/**`, `README.md`, `PROJECT_CHECKLOG.md`): **150**
  - `: any` codefokussiert: **120**
  - `as any` im produktiven Runtime-/App-/Edge-Code: weiter **0** bestaetigte Treffer
  - `: any` im non-test/non-doc Produktionscode: **43**
- Die naechsten produktionsnahen `: any`-Hebel liegen damit jetzt klarer bei `project/services/templateLoader.ts`, `lib/diagnostics/smartPatch.ts`, `lib/diagnostics/buildPipelineDiagnostics.ts` und `supabase/functions/github-workflow-logs/helpers.ts`.


**Update (Patch 669, 2026-03-31, Durchlauf 29):**
- Der cross-screen small typing block ist helper-first nachgezogen:
  - `screens/AppStatusScreen/components/OverviewSection.tsx` nutzt jetzt eine schmale `ProjectData`-View statt `projectData: any`,
  - `screens/AppStatusScreen/hooks/useAppStatusScreen.ts` fuehrt keinen irrefuehrenden `any`-Kommentar mehr,
  - `screens/CodeScreen/index.tsx` tipisiert den `beforeRemove`-Event ueber React-Navigation-Typen statt `e: any`,
  - `screens/CredentialsWizardScreen/components/KeystoreStatusSection.tsx` nutzt einen getypten Ionicons-Namen statt `icon: any`,
  - `screens/EnhancedBuildScreen/hooks/useOneClickDeploy.ts` haertet Build-/Secret-Sync-Fehlerpfade ueber `unknown` + `getOneClickDeployErrorMessage(...)`,
  - `shared/types/build.ts` fuehrt `raw` nur noch als `unknown`.
- Deep-Scan-Nachcheck auf dem aktuellen Stand:
  - `as any` gesamt: **381**
  - `: any` gesamt: **237**
  - `as any` codefokussiert (ohne `docs/**`, `README.md`, `PROJECT_CHECKLOG.md`): **150**
  - `: any` codefokussiert: **78**
  - `as any` im produktiven Runtime-/App-/Edge-Code: weiter **0** bestaetigte Treffer
  - lokale `useNavigation<any>()` / `useRoute<any>()`-Signaturen in produktiven Screens: jetzt **0**
  - verbliebene produktionsnahe `any`-Formen sind aktuell fast nur noch **generische `<any>`-Reader** in Diagnostics-/Status-Helfern plus ein Tooling-Skript-Rest.

**Update (Patch 670, 2026-03-31, Durchlauf 30):**
- Der Navigation-/Route-Typing-Cluster ist jetzt geschlossen:
  - `screens/ChatScreen/hooks/useChatScreen.ts` nutzt getypte Chat-Route-/Navigation-Parameter statt `useNavigation<any>()` / `useRoute<any>()`,
  - `screens/DiagnosticScreen/index.tsx` verwendet einen getypten `DiagnosticRoute`-Vertrag plus `NavigationProp<ParamListBase>`,
  - `screens/EnhancedBuildScreen/index.tsx` verwendet `NavigationProp<ParamListBase>` statt `useNavigation<any>()`.
- Der naechste produktionsnahe Typing-Hebel sind damit nicht mehr Screen-Navigationen, sondern generische `<any>`-Reader in Diagnostics-/Status-Helfern.



**Update (Patch 671, 2026-03-31, Durchlauf 31):**
- Der Diagnostic-checks-JSON-Block ist jetzt helper-first gehaertet:
  - `lib/diagnostics/checks/qualityAndCompat.ts`, `packageAndEntry.ts` und `configAndProfiles.ts` nutzen kleine Unknown-/Record-Reader statt `parseJson<any>(...)`.
- Damit bleiben im produktionsnahen Non-Test-Code aktuell nur noch **3** `: any`-/`<any>`-Formen, vor allem in `screens/AppStatusScreen/hooks/appStatusHelpers.ts`, `lib/diagnostics/buildPipelineDiagnostics.ts` und einem Tooling-Skript.

**Update (Patch 672, 2026-03-31, Durchlauf 32):**
- Der Generic-`<any>`-Follow-up in produktionsnahen Helpern ist jetzt geschlossen:
  - `screens/AppStatusScreen/hooks/appStatusHelpers.ts` liest `app.json` ueber lokale Unknown-/Record-Reader statt `safeJsonParse<any>`.
  - `lib/diagnostics/buildPipelineDiagnostics.ts` nutzt im expo-dev-client-Check `readJsonFile<unknown>` + `readStringDeps(...)` statt `readJsonFile<any>`.
- Produktionsnaher Reststand damals: **0** `as any` und **1** `: any`/`<any>` im non-test/non-doc Code; der letzte verbleibende Nicht-Test-Rest lag zu diesem Zeitpunkt nur noch in einem einmaligen Forge-Patch-Skript, das spaeter ebenfalls aus dem aktiven Repo entfernt wurde.

**Update (Patch 674, 2026-03-31, Durchlauf 34):**
- Fokus bewusst auf Test-/Fixture-Debt der zuletzt refactorten Bereiche gelegt.
- Neue Test-Helper (`findCheckById`, `makeProjectFile`, `pluckIds`) ziehen Diagnostics-/Pipeline-/ProjectFile-Fixtures helper-first ohne lokale `as any`-Casts.
- `appInfoSecureBackup.test.ts` nutzt jetzt `AIConfig` plus echtes Union-Narrowing statt `baseConfig: any` / `restored as any`.
- Relevanter Nachscan: produktiver Runtime-/App-/Edge-/Helper-Code sowie Non-Test-/Non-Doc-Tooling bleiben bei **0** verbleibenden `as any`-/`: any`-/`<any>`-Resten; der Hauptrest liegt jetzt klar in Build-/Readiness-/Auth-/Notification-Tests und Mock-Factories.

**Update (Patch 675, 2026-03-31, Durchlauf 35):**
- Build-/Readiness-/Diagnostics-Testcluster helper-first nachgezogen:
  - `buildReadiness*`- und `buildStartService.readinessContract`-Tests nutzen jetzt `makeProjectData(...)` statt lokaler `ProjectData as any`-/`ProjectFile as any`-Fixtures,
  - `diagnosticRunners.repoSync.test.ts` nutzt `makeProjectFile(...)` + `createMountedRef(...)`,
  - `lib/__tests__/buildStartService.integration.test.ts` arbeitet ohne `computeProjectFilesSignature(project.files as any)`- und Session-Mock-Casts.
- Produktiver Runtime-/App-/Edge-/Helper-Code bleibt weiter bei **0** verbleibenden `as any`-/`: any`-/`<any>`-Resten; der relevante Rest konzentriert sich jetzt noch staerker auf Test-Utilities / Mock-Factories.


**Update (Patch 676, 2026-03-31, Durchlauf 36):**
- Test-/Mock-Utility-Wave 3 in drei fokussierten Bereichen ohne Produktcode-Oeffnung:
  - `lib/__tests__/notificationService.test.ts` nutzt jetzt einen getypten `NotificationServiceInternals`-View und `jest.Mocked<typeof Notifications>` statt `notificationService as any`-/`mockExpoConstants: any`-Zugriffen,
  - `lib/__tests__/retryWithBackoff.test.ts` kapselt Retry-Tagging helper-first ueber `RetryableTestError` statt `(error as any).retryable`,
  - `__tests__/useNotifications.permissions.regression.test.tsx` mockt `initialize`/`getPushToken` direkt ohne Spread-`any[]`.
- Produktiver Runtime-/App-/Edge-/Helper-Code bleibt weiterhin frei von `as any`; der verbleibende Rest konzentriert sich auf breitere contract-/mock-nahe Testdateien.

#### Offene, riskante Restpunkte (Stand nach Patch 676)
1. **Test-/Fixture-Debt (Build-/Readiness-/Diagnostics-Cluster)** — produktionsnaher Code bleibt clean; der naechste echte Hebel liegt bei ProjectFile-/ProjectData-Fixtures, AsyncStorage-Mocks und `find(...).id`-Casts in Build-/Readiness-/Diagnostics-Tests.
2. **Test-Utilities / Mock-Factories** — Notification-/Retry-/Auth-/fetch-nahe Test-Helper tragen noch einen grossen Teil der verbliebenen `any`-Reste.
3. **Monolithische Hook-Hotspots** — die grossen Orchestrierungsdateien bleiben die groesste Wartungs- und Regressionsflaeche, auch wenn helper-first Extraktionen bereits viel entschaerft haben.

#### Empfohlene naechste Reihenfolge
1. Test-Utilities / Mock-Factories helper-first nachziehen
2. Notification-/Retry-/Auth-/fetch-nahe Fixture-Welle
3. Danach neuer Deep Scan auf den post-test-debt-Reststand
4. Danach nur dann weitere helper-first Hook-Schnitte oder Bugfixes, wenn ein konkreter Wartungshebel oder Incident sie wirklich noetig macht


**Update (Patch 678, 2026-03-31, targeted contract/mock cleanup wave 4):**
- Test-/Contract-Reste im auth-/fetch-/contract-Cluster wurden helper-first reduziert:
  - `auth.failClosedAndDurableRateLimit.test.ts` nutzt getypte `fetch`-Spies ohne `"fetch" as any`,
  - `edgeErrorResponseContracts.test.ts` liest Response-Bodies ueber einen `JsonRecord`-Reader statt `Promise<any>`,
  - `githubFiles.contracts.test.ts` arbeitet ohne `response(...) as any`,
  - `chatHistoryMigration.test.ts` nutzt typed AsyncStorage-Mock-Helper statt `AsyncStorage as any`,
  - `bridgeValidation.test.ts` reduziert die letzten lokalen Testcasts auf `unknown`-/Record-Narrowing.
- Relevanter Nachscan: weiterhin **0** `any`-Reste ausserhalb von Tests/Docs/Historie; der verbleibende Debt sitzt jetzt fast ausschliesslich in breiteren Test-/Mock-/Fixture-Dateien.

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


**Update (Patch 673, 2026-03-31, Durchlauf 33):**
- Der letzte verbliebene Non-Test-`any`-Rest in einem einmaligen Forge-Patch-Skript war zu diesem Zeitpunkt geschlossen; das Skript wurde spaeter im Tooling-Cleanup vollstaendig aus dem aktiven Repo entfernt.
- Relevanter Nachscan: produktiver Runtime-/App-/Edge-/Helper-Code sowie Non-Test-/Non-Doc-Tooling enthalten damit aktuell **0** verbleibende `as any`-/`: any`-/`<any>`-Reste; der naechste echte Hebel liegt jetzt in Test-/Fixture-Debt.

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
- Patch 598 reduzierte die generische Legacy-Admin-Guard-Drift: `requireAdminKey(...)` akzeptiert keinen `SIGNING_ADMIN_KEY`-Fallback mehr; historische Legacy-Routen wurden seither weiter reduziert. `create_codesandbox` ist inzwischen deaktiviert (`enabled = false`, `410 legacy_create_codesandbox_disabled`), `save_preview` bleibt der JWT-geschuetzte Standardpfad.
- Patch 599 schliesst den Keystore-Config-Split-Brain: widerspruechliche lokale `verify_jwt=false`-Configs fuer `android-keystore-status`/`android-keystore-generate` wurden entfernt; fail-closed SoT ist jetzt eindeutig `supabase/config.toml` mit `verify_jwt=true`.
- Patch 608 zieht denselben SoT-Cleanup fuer `android-keystore-export` nach: auch dort gibt es keine funktionslokale `config.toml` mehr, damit alle gehaerteten Keystore-Routen nur noch eine `verify_jwt`-Quelle haben (`supabase/config.toml`).
- Patch 600 entfernt verbleibende stille Legacy-Fallbacks in workflow-/build-/artifact-nahen Ops-Skripten: `scripts/ci-lite-env-load.sh` und `scripts/ci-lite-smoke.sh` verwenden nur noch `K1W1_EDGE_WORKFLOW_ADMIN_KEY` (kein `ADMIN_KEY`/`K1W1_EDGE_ADMIN_KEY`-Alias mehr), damit fehlende scoped Workflow-Keys nicht mehr als false-green durchlaufen.
- Patch 602 schliesst den verbleibenden JWT-/Ref-Vertragsbruch im selben Script-Scope: `scripts/ci-lite-smoke.sh` ruft JWT-pflichtige workflow-/build-nahe Routen nur noch mit `Authorization: Bearer <K1W1_EDGE_WORKFLOW_JWT>` plus scoped Workflow-Key auf und verlangt einen expliziten `<ref>` (kein stilles `main` mehr).
- Patch 601 schliesst den Restpunkt `supabase/functions/test` explizit: alte Testroute ist jetzt fail-closed (`requireScopedEdgeAuth` + immer `410 legacy_test_route_disabled`) und kann nicht mehr als halboffene Altflaeche mit unklarem Auth-Vertrag stehen bleiben.
- Patch 603 korrigiert den verbleibenden Vertragsfehler in genau dieser Testroute: der Scoped-Guard enthaelt jetzt verpflichtend `allowAdmin: true` und `scope: "test"`, damit keine `500`-Auth-Misconfiguration den beabsichtigten `410 legacy_test_route_disabled`-Pfad verdeckt; Contract-Checks/Invariants blocken die Rueckdrift explizit.
- Patch 609 schiebt den Sunset im Client weiter auf scoped-only Runtime: Wizard- und Signing-Gate lesen keinen Legacy-Edge-Key mehr fuer Keystore-Readiness, und SecretsSection wertet fehlenden Legacy-Key nicht mehr als aktuellen Runtime-Blocker; verbleibende Legacy-Reste sind explizit als Compat-/Altpfade begrenzt und per Invariant/Contract-Check abgesichert.
- Fix-/Verifikationsdurchlaeufe heben den Preview-Standardpfad anschliessend weiter auf einen verifizierten Supabase-Login-JWT-Vertrag; `save_preview` ist im aktuellen Repo-Stand kein lokaler Legacy-Key-Pfad mehr.
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

**Update (Patch 686, 2026-03-31, Durchlauf 46):**
- Contract-/Invariant-Testwelle helper-first nachgezogen:
  - `patch570.typeContracts.invariants.test.ts` und `ciLitePatch.invariants.test.ts` lesen Repo-Quellen jetzt ueber den gemeinsamen Helper `readRepoText(...)` statt lokaler `fs/path`-Reader-Duplikate,
  - `supabaseErrorSanitization.test.ts` nutzt Unknown-/Record-/Array-Reader statt `sanitizeUnknownForTransport(...) as any`,
  - `savePreview.authCorsAndTypecheck.invariants.test.ts` ersetzt `globalThis.Deno as any` ueber einen kleinen Runtime-Helper und schliesst den verwaisten letzten `it(...)`-Block wieder in den `describe(...)`-Scope ein.
- Ausserhalb von Tests/Docs/Historie bleiben weiterhin keine `any`-Reste im produktiven Runtime-/App-/Edge-/Helper-Code bestaetigt.


**Update (Patch 687, 2026-03-31, Durchlauf 47):**
- UI-/Workflow-Testwelle helper-first nachgezogen:
  - `App.test.tsx` nutzt jetzt getypte Children-Props statt `Navigator`-/`Screen`-/`NavigationContainer`-Komponenten mit `any`,
  - `smoke.test.ts` verwendet explizite Mock-Typen fuer AsyncStorage und SecureStore statt `let AsyncStorage: any` / `let SecureStore: any`,
  - `invariants.strings.test.ts` vergleicht die kanonischen Workflow-Dateinamen ohne `as any`-Casts.
- Ausserhalb von Tests/Docs/Historie bleiben weiterhin keine `any`-Reste im produktiven Runtime-/App-/Edge-/Helper-Code bestaetigt.

**Naechste sinnvolle Schritte nach Patch 688:**
- 49: Invariant string/test helper hygiene (nur falls helper-first echter Wartungsnutzen entsteht).
- 50: docs/history compaction fuer README/Patchlog/Checklog.
- 51: erneuter Deep Scan + Stabilitaetsentscheidung.


**Update (Patch 691, 2026-03-31, Deep-Scan-/Stabilitaetsentscheidung):**
- Neuer Deep Scan nach der Docs-/History-Kompaktion bestaetigt: ausserhalb von Docs, Checklog, Review und Historie sind aktuell keine `as any`-/`: any`-/`<any>`-Reste mehr offen.
- Der verbleibende `any`-Debt ist damit praktisch nur noch Dokumentations-/Historienmaterial und kein produktiver Runtime-/Test-/Tooling-Hotspot mehr.
- Konsequenz: weitere Refactor-Wellen nur noch bei neuem belegbarem Produkt-/CI-/Debt-Befund; standardmaessig gilt ab hier ein bewusstes Stabilitaetsfenster.

**Naechste sinnvolle Schritte nach Patch 691:**
1. Kein blinder weiterer Refactor-Durchlauf.
2. Docs-/History-Hygiene nur bei echter neuer Drift.
3. Neuer Deep Scan erst nach neuem Feature-/Bugfix-Block oder bei reproduzierbarem Symptom.


**Update (Patch 692, 2026-03-31, bedingter Docs-/History-Hygiene-Check):**
- Verifikationslauf nach Patch 691 bestaetigt: Kern-MDs (`README.md`, `docs/TODO.md`, `docs/INDEX.md`, `docs/TESTING_GUIDE.md`, `docs/FRESH_CHECKOUT_GREEN_PATH.md`) sowie `PROJECT_CHECKLOG.md` und `docs/patches/PATCHLOG_ROOT.md` laufen ohne neue Header-/Patchstand-Drift.
- Es wurde bewusst kein neuer Produkt-/Refactor-Block geoeffnet; Patch 692 ist ein reiner SoT-/Stabilitaetsnachzug.

**Naechste sinnvolle Schritte nach Patch 692:**
1. Docs-/History-Hygiene nur bei echter neuer Drift erneut oeffnen.
2. Gezielten Bugfix/Test-Fix nur bei reproduzierbarem Produkt-/CI-Symptom oeffnen.
3. Neuer Deep Scan erst nach neuem Feature-/Bugfix-Block oder bei echtem Anlass.

**Update (Patch 693, 2026-03-31, kritischer Follow-up-53-Verifikationslauf):**
- Erneuter Nachcheck nach Patch 692 zeigt keinen reproduzierbaren Produkt-/CI-Befund und keine neue Kern-MD-/Patch-/Checklog-Drift.
- Patch 693 fuehrt deshalb bewusst **keinen** neuen Produkt-/Refactor-Block ein, sondern schliesst Follow-up 53 als Truthfulness-/SoT-Patch.

**Naechste sinnvolle Schritte nach Patch 693:**
1. Neuer Deep Scan erst nach neuem Feature-/Bugfix-Block oder bei echtem Anlass.
2. Gezielte Bugfix-/Test-Fix-Arbeit nur bei reproduzierbarem Symptom.
3. Bis dahin gilt weiter bewusst ein Stabilitaetsfenster.


**Update (Patch 694, 2026-03-31, kritischer Pass-53-Nachzug):**
- Zwei belastbare Deep-Scan-Funde direkt geschlossen:
  - `utils/syntaxValidator.ts` zaehlt Delimiter jetzt ueber einen kleinen Scanner **ausserhalb** von Strings/Regex/Kommentaren und prueft Import-Nutzung auf `codeWithoutImports` statt auf dem rohen Gesamttext; neue Regressionen decken False-Positives fuer Regex/String-Kommentare sowie echte/unechte Unused-Import-Faelle ab.
  - `supabase/functions/_shared/auth.ts` nutzt fuer `verifyJwtViaSupabaseAuth(...)` sowie die beiden Durable-Rate-Limit-REST-Calls jetzt einen gemeinsamen 8s-`AbortController`-Wrapper; `rateLimit(...)` fuehrt bei >5k lokalen Keys ein konservatives Eviction-Cleanup fuer klar veraltete Eintraege aus.
- Kein Produkt-/Auth-Vertrag wurde gelockert; der Follow-up reduziert False-Positive-Editorfehler und begrenzt Edge-Wartezeiten im Fehlerfall.


**Update (Patch 695, 2026-03-31, Template-Literal-Nachzug auf Patch 694):**
- `utils/syntaxValidator.ts` behandelt Delimiter innerhalb von Template-Literal-Ausdruecken `${...}` jetzt ebenfalls als echten Codepfad. Damit ist der im Nachscan auf Patch 694 identifizierte False-Negative-Rest fuer unausgeglichene Klammern in `${...}` direkt geschlossen.
- Der Import-/Delimiter-Check bleibt weiterhin heuristisch und bewusst leichtgewichtig; ein AST-basierter Ersatz ist aktuell nicht noetig.