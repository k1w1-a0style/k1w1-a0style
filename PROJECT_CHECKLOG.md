## 2026-03-16 — Patch 468: GitHubReposScreen-Architekturblock (Sync/Push) konservativ beruhigt

- Letzter bestätigter GitHubReposScreen-Architekturrest gezielt adressiert: Sync-Status nutzt jetzt einen zentralen Infra-Vergleich auf Tree-SHA-Basis statt per-file Contents-Reads im Screen-Hook.
- Multi-File-Push wurde von dateiweisen Contents-Commits auf den Git-Data-Pfad (Tree → Commit → Ref-Update) umgestellt; Ergebnis ist ein konsolidierter Commit pro Push-Lauf.
- Repo-/Branch-SoT- und stale-run-Guards im Screen-Hook blieben unverändert erhalten; kein Broad-Refactor außerhalb des GitHubRepos-/RepoSync-Blocks.
- Architektur-Invariants ergänzt: `__tests__/patch468.githubReposScreen.architecture.invariants.test.ts`.

Checks (lokal):
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## 2026-03-16 — Patch 467: Allgemeiner flow-naher Maintenance-/Typing-Block konservativ entschärft

- Verbliebene produktnahe Typing-Reste ohne Broad-Refactor nachgezogen: `useChatAIFlow` Validator-Map ohne `any`, `useGitHubActionsLogs` Error-`catch` auf `unknown` und toter Secret-Import entfernt.
- `describeEdgeFailure(...)` typisiert den internen Edge-Error-Body jetzt über ein enges lokales Payload-Interface statt `any`.
- Chat-History-Migrationspfad (`ensureChatHistoryHasIds`) wurde auf `unknown[]` + lokalen Guard umgestellt; Verhalten bleibt gleich, Typvertrag ist robuster.
- Keine Architekturänderungen, keine massenhafte Test-/Template-Bereinigung; Fokus blieb auf flow-nahen Restpunkten.

## 2026-03-16 — Patch 466: CodeScreen/File-Editor/File-Actions Restpunkte konservativ geschlossen

- Patch 466: WebCodeEditor nutzt jetzt im CodeScreen denselben shared WebView-Crash-Recovery-Mechanismus wie der Preview-Bereich (`onContentProcessDidTerminate` + `onRenderProcessGone`) ohne neue Editor-Architektur.
- Folder-Delete in `useFileActions` läuft gebatcht über `deleteFiles(paths)` statt sequentiellem Einzel-Delete.
- `ProjectContext`/`projectTypes` wurden minimal um `deleteFiles(...)` erweitert, sodass der Batch-Delete in einem Update laufen kann.
- `handleDeleteFile` hat einen expliziten Guard für fehlendes Action-Target (kein stiller Direktpfad).
- Gezielt ergänzt: `__tests__/webCodeEditor.recovery.test.tsx` und `__tests__/useFileActions.regression.test.tsx`.

Checks (lokal):
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## 2026-03-16 — Patch 465: SettingsScreen/AIContext-Restpunkte (Retention-Input + Hydration-Race) final geschlossen

- `screens/SettingsScreen/hooks/useSettingsScreen.ts`: Retention-Save nutzt jetzt einen dedizierten Parser, der leere Eingaben explizit als ungültig behandelt (statt implizit `0`), und meldet dies klar per Alert zurück.
- `screens/SettingsScreen/hooks/settingsHelpers.ts`: `parseRetentionLimitInput(...)` ergänzt (trim/non-empty + number>=0 + floor), damit der kritische Parsing-Pfad zentral und testbar ist.
- `contexts/ProjectContext.tsx`: Hydration-Guard für Runtime-Retention ergänzt (`didSetRuntimeRetentionRef` + `shouldApplyHydratedRetention`), damit ein verspäteter Initial-Load keinen frisch gesetzten Runtime-Wert überschreibt.
- Optionaler Micro-Cleanup: `handleMoveKeyToFront` im Settings-Hook minimiert doppelten Fallback-Try-Code bei identischem Verhalten.
- Regressionstests ergänzt: `__tests__/settingsScreen.retentionInput.test.ts` (leer -> invalid, kein stilles `0`) und `__tests__/projectContext.retentionHydrationGuard.test.ts` (Hydration-Override wird nach Runtime-Set blockiert).

## 2026-03-16 — Patch 464: GitHubReposScreen Defensivfix für malformed `project.files`

- Offener Restpunkt geschlossen: lokale `project.files` werden im RepoScreen zentral über `normalizeProjectFiles(...)` validiert; `null`/malformed Legacy-Einträge werden gefiltert statt iteriert.
- `useGitHubReposScreen` nutzt die normalisierte Liste auch in Push-/Selection-Pfaden, damit keine Laufzeit-Crashes durch ungültige Dateieinträge entstehen.
- Regression ergänzt: `__tests__/projectFiles.normalize.regression.test.ts` deckt `null`/invalid-Einträge explizit ab; bestehende Invariant-Datei für den typed Root-Pfad aktualisiert.

Checks (lokal):
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## 2026-03-15 — Patch 463: SettingsScreen + AIContext Restpunkte (Quality/Retention/Typing) konservativ geschlossen

## 2026-03-16 — Patch 463 Follow-up (PR #278 review): Retention-Save sofort wirksam

- `screens/SettingsScreen/hooks/useSettingsScreen.ts` aktualisiert nach dem Persistieren des Retention-Limits zusätzlich direkt die Runtime im `ProjectContext` (`setChatRetentionLimit`), sodass neue Limits sofort gelten.
- `contexts/ProjectContext.tsx` kapselt die Runtime-Aktualisierung inkl. sicherer Limit-Sanitization und trimmt bestehende History sofort auf das neue Limit.
- Regression ergänzt: `__tests__/projectContext.retentionLimitSanitizer.test.ts` prüft die Sanitization-Invarianten.

Checks (lokal):
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/projectContext.retentionLimitSanitizer.test.ts`
- `npm run test:silent`

- Quality-Mode wirkt jetzt real auf die effektiven Modellauswahlen: `setQualityMode(...)` setzt zusätzlich `selectedChatMode`/`selectedAgentMode` passend zur gewählten Persona (speed vs. quality/review), sodass der Wechsel nicht nur kosmetisch bleibt.
- SettingsScreen zieht den gleichen Nutzerfluss sauber nach: Quality-Button-Selection setzt unmittelbar die aktiven Modelle für Generator+Agent, statt alte Modell-IDs stehen zu lassen.
- Privacy-Retention ist kein halbfertiger Read-only-Hinweis mehr: Retention-Limit ist im SettingsScreen jetzt direkt editierbar und wird über `setChatHistoryRetentionLimit(...)` persistiert.
- Flow-nahe Restpunkte mit geringem Risiko nachgezogen: Gemini-Key-Prefix-Validation (`AIza`) ergänzt; `getProviderStatus` im Settings-Hook als getypte Helper-Normalisierung ohne `any` umgesetzt; tote/deprecated Helper-Reste in AIContext bereinigt.
- UX beim Key-Remove minimal ehrlicher: Beim Entfernen des letzten Keys wird dies im Confirm-Dialog explizit erwähnt.
- Tests ergänzt: `__tests__/aiContext.qualityMode.test.tsx` und `__tests__/settingsScreen.helpers.test.ts` decken Quality-Mode↔Modell-Mapping, Provider-Status-Normalisierung und Gemini-Key-Validation ab.

Checks (lokal):
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## 2026-03-15 — Patch 462: GitHubReposScreen-Restpunkte (Typing/Sync/Branch) konservativ geschlossen

- Root-Typing im RepoScreen-Hook bereinigt: `projectData?.files` wird als `ProjectFile[]` geführt (kein `projectFiles as any[]`-Root-Cast mehr), plus reduzierte Pull-/Push-nahe Folge-Casts (`handlePull`, Push-Auswahl, `applyPulledFiles`).
- `refreshSyncStatus` ist jetzt stale-resistent: laufende Async-Ergebnisse committen nur noch, wenn der Lauf noch aktuell ist (`syncStatusRunRef`), wodurch Repo-/Branch-Wechsel keine alten Statusdaten mehr zurückschreiben.
- `handleCreateRepo` übernimmt nach erfolgreicher Repo-Erstellung den von GitHub gelieferten `default_branch` unmittelbar in Active-/Linked-Branch, statt den Branch pauschal auf `null` zu setzen.
- Typing-Nachzug: `GitHubRepo` enthält optional `default_branch`, damit Repo-Selection/Create ohne `as any` auf Branch-Infos zugreifen kann.
- Regressionen ergänzt: `__tests__/patch462.githubReposScreen.restFixes.invariants.test.ts` prüft Root-Typing, stale-run-Guard und Default-Branch-Übernahme.

Checks (lokal):
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## 2026-03-15 — Patch 461: Chat-Restregressionen (#272/#273) gemeinsam final geschlossen

- `hooks/useChatAIFlow.ts`: Pending-Plan-Handoff nutzt bei leerem `rawInput` jetzt `aiContent || userContent`, damit Attachment-only-Details im normalen AI-Pfad nicht verloren gehen.
- Meta-/lokale Command-Logik bleibt unverändert auf `rawInput` gebunden; der Attachment-Hinweis bleibt auf den normalen AI-Pfad begrenzt.
- Invariant-Regression erweitert (`__tests__/useChatAIFlow.metaCommandAttachment.regression.test.ts`) inkl. Pending-Plan-Handoff-Fallback-Absicherung.

Checks:
- `bash scripts/check_workflow_template_drift.sh` ✅
- `bash scripts/check_managed_workflows.sh` ✅
- `bash scripts/check_workflow_edge_contracts.sh` ✅
- `bash scripts/check_legacy_disabled_edges.sh` ✅
- `bash scripts/check_patch_docs_sync.sh` ✅
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent` ✅

## 2026-03-15 — Patch 460: Chat Attachment-only Regression nach PR #273 geschlossen

- `hooks/useChatAIFlow.ts`: `handleSendWithMeta(...)` verwirft Requests nicht mehr allein bei leerem `rawInput`; der Guard abortiert nur noch bei gleichzeitig leerem `rawInput` **und** `aiInput`.
- Meta-/lokale Kommandos bleiben auf unverändertem Raw-Input (`userContent`) verdrahtet; damit bleibt Full-line-Command-Routing stabil.
- Attachment-only-Sendefälle (leerer Texteingang, aber AI-Input mit Attachment-Hinweis) laufen wieder deterministisch in den normalen AI-Pfad; User-Message nutzt dafür einen kontrollierten Fallback auf `aiInput`.
- `__tests__/useChatAIFlow.metaCommandAttachment.regression.test.ts` als gezielte Invariant-Regression entsprechend nachgezogen.

Checks (lokal):
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## 2026-03-15 — Patch 459: Chat-Regression (PR #272) konservativ nachgezogen

- Verbliebene Regression geschlossen: Attachment-Hinweis wird nicht mehr vor dem lokalen/meta Command-Routing an den Raw-Input angehängt.
- `handleSendWithMeta` trennt jetzt `rawInput` (für User-Message + Meta-Command-Match) und `aiInput` (nur für normalen AI-Request).
- `cat <pfad>` und `zeige datei <pfad>` behalten damit Full-line-Matches auch dann, wenn ein Attachment ausgewählt wurde.
- Minimaler Typing-Nachzug: Attachment-Hinweis-Helper akzeptiert nur noch `name`/`size` (geringere Kopplung).
- Regression ergänzt: `__tests__/useChatAIFlow.metaCommandAttachment.regression.test.ts`.

Checks (lokal):
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## 2026-03-15 — Patch 458: ChatScreen/Chat-Flow Restpunkte konservativ geschlossen

- Attachment-/DocumentPicker-Flow kommuniziert jetzt ehrlich: Chat ergänzt bei Dateianhang expliziten Hinweis, dass aktuell nur Dateiname/Metadaten (nicht voller Dateiinhalt) übergeben werden.
- Chat-History wird in `addChatMessage` direkt beim Append per Retention-Limit begrenzt (Settings-basiert, Fallback 200), damit In-Memory-History nicht unbegrenzt wächst.
- Focus-Cleanup im ChatScreen räumt Pending-Plan/Pending-Change, Modal, Streaming und Inflight-Requests konservativ auf (`resetTransientState`), damit beim Verlassen keine hängenden UI-Zustände bleiben.
- `chatAIFlowTypes` bereinigt (tote Imports entfernt) und `extractRawOrchestratorResult` sauber typisiert.
- Regressionen ergänzt: `__tests__/chatScreenAttachmentNotice.test.ts`, `__tests__/projectContext.chatRetention.test.ts`.

Checks (lokal):
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## 2026-03-15 — Patch 457: Connections Busy-Guard-Signal korrigiert + Chat-Guard verifiziert

- `withBusyGuard` trennt jetzt echte Busy-Kollisionen über dedizierten `BusyGuardActiveError` von normalen Fehlern (kein boolesches Mehrdeutigkeits-Signal mehr).
- `saveAll`, `testGitHub`, `testExpo`, `testSupabase` behandeln Busy-Kollision und echte Fehlerpfade getrennt; der Busy-Hinweis erscheint nur noch im Konkurrenzfall.
- `useChatAIFlow`-Pending-Plan-Guard (`mode === "advice" && !wantsProceed`) gezielt verifiziert und per Invariant abgesichert; kein funktionaler Fix nötig.
- Regressionen ergänzt: `__tests__/busyGuard.test.ts`, aktualisierte/ergänzte Flow-Invariants.

Checks (lokal):
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## 2026-03-15 — Patch 456: Chat-Drift-Digest RN-Guardrail

- `lib/chatFlowStateGuards.ts` dokumentiert jetzt explizit, dass dieser Pfad im React-Native-App-Runtime-Kontext läuft und daher **keine** Node-Core-Imports wie `crypto` enthalten darf.
- Damit ist der Drift-Digest-Pfad gegen Metro-Resolve-Regressionen abgesichert; Hashing bleibt runtime-safe ohne Node-Polyfill-Abhängigkeit.

Checks (lokal):
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## 2026-03-15 — Patch 455: ConnectionsScreen Secret-/Flow-Restpunkte konservativ gehärtet

- Supabase-ANON-Key im Connections-Flow auf SecureStore umgestellt (`supabase_anon_key_v1`) inkl. Legacy-Migration aus AsyncStorage (`STORAGE_KEYS.SUPABASE_KEY`) und Cleanup des Legacy-Keys.
- Busy-/Parallel-Execution-Guard (`withBusyGuard` + `busyRef`) für `saveAll`, `testGitHub`, `testExpo`, `testSupabase` ergänzt; UI-Actions bleiben bis Hydration deaktiviert.
- `testExpo` persistiert den Token nicht mehr implizit als Side-Effect; Persistenz bleibt am expliziten Save/Import.
- EAS-Link-Flow setzt `CONN_EAS_OK` nach Workflow-Start nicht mehr optimistisch auf grün, sondern bleibt bis echter Verifikation neutral/false.
- Flow-nahe Tests ergänzt (`supabaseAnonKeyStorage` + Connections-Flow-Invariants).

Checks (lokal):
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## 2026-03-15 — Patch 454: OneClickDeploy-Testflake stabilisiert

- Echte Timeout-Ursache im Testkontext adressiert: Press-Event startet den async Hook-Flow jetzt deterministisch in `act(...)` inkl. Microtask-Flush statt impliziter Scheduling-Rennen.
- AsyncStorage-Mocks pro Test mit stabilen Default-Resolves initialisiert; dadurch hängen frühe Hook-Effekte (`ONE_CLICK_AUTO_SYNC_SECRETS`) nicht mehr an implizitem Mock-Zustand.
- Nach jedem Test erzwungenes `cleanup()` + `jest.clearAllTimers()` minimiert Seiteneffekt-Leaks zwischen Tests; Produktcode blieb unverändert.

Checks (lokal):
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `npm run test:silent -- --runInBand __tests__/oneClickDeploy.test.tsx`


## 2026-03-15 — Patch 453: KI-/Chat-Nachaudit (misstrauisch)

- Echte Restlücke geschlossen: `normalizeAiResponseDetailed` übernimmt bei `{ output_text: ... }` den Text jetzt als `responseText`, sodass der Builder-Non-JSON-Fehlerpfad verständliche KI-Preview behält.
- Regressionstests nachgeschärft: `output_text`-Fallback und `no_valid_files_after_normalization` sind explizit abgedeckt.
- Full-Suite lief im Audit-Lauf vollständig grün; der Fokus dieses Patches bleibt dennoch strikt auf dem KI-/Chat-Restpunkt.

Checks (lokal):
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand lib/__tests__/normalizer.test.ts __tests__/promptEngine.contextPriority.test.ts __tests__/chatFlowStateGuards.test.ts lib/__tests__/projectOwnership.test.ts`
- `npm run test:silent`

# PROJECT_CHECKLOG

Kurzlog für den laufenden Stand. Detailhistorie bleibt im Patchlog.

## Zuletzt geprüft / aktualisiert

- 2026-03-15: Patch 461: Chat-Restregressionen aus PR #272/#273 gemeinsam final geschlossen; Meta-/lokale Kommandos laufen weiterhin auf unverändertem Raw-Input, Attachment-only wird nicht still verworfen, und Pending-Plan-Handoff übernimmt bei leerem Raw den `aiInput`-Fallback; Invariant-Regression plus Workflow-/Typecheck-/Lint-/Tests grün.
- 2026-03-15: Patch 460: Chat-Regression nach PR #273 konservativ geschlossen — `useChatAIFlow.handleSendWithMeta(...)` bricht nur noch bei gleichzeitig leerem Raw-/AI-Input ab; Attachment-only-Sendefälle werden nicht mehr still verworfen, Meta-/lokale Kommandos laufen weiterhin ausschließlich auf unverändertem Raw-Input; gezielte Invariant-Regression ergänzt.
- 2026-03-15: Patch 457: Connections-Busy-Guard meldet Busy-Kollisionen jetzt explizit (dedizierter Error) statt mehrdeutigem `false`; Save/Test-Aktionen trennen Busy vs. echte Fehler sauber. `useChatAIFlow`-Pending-Plan-Guard wurde gezielt geprüft und per Invariant abgesichert.
- 2026-03-15: Patch 456: Chat-Drift-Digest RN-sicher dokumentiert — `lib/chatFlowStateGuards.ts` enthält jetzt eine explizite Guardrail-Notiz gegen Node-`crypto` im App-Runtime-Pfad (`useChatAIFlow`), damit Metro-Bundles keine Node-Core-Module auflösen müssen.
- 2026-03-15: Patch 455: ConnectionsScreen-Restpunkte konservativ gehärtet — Supabase-ANON-Key jetzt SecureStore-basiert (inkl. Legacy-Migration), Busy-/Hydration-Guards blockieren parallele Save/Test-Runs, `testExpo` ohne Token-Persistenz-Side-Effect, EAS-Link-Lampe nicht mehr optimistisch grün; flow-nahe Invariants + Storage-Tests ergänzt.
- 2026-03-15: Patch 454: OneClickDeploy-Testflake in `__tests__/oneClickDeploy.test.tsx` gezielt stabilisiert (deterministischer `act`-Press + Microtask-Flush, AsyncStorage-Default-Resolves, striktes Cleanup/Timer-Clear); kein Produktcode-Umbau.
- 2026-03-15: Patch 453: Misstrauisches KI-/Chat-Nachaudit — echte Restlücke im Non-JSON-Fehlerpfad geschlossen (`output_text` wird im Normalizer als Response-Text durchgereicht), gezielte Regressionstests ergänzt; Full-Suite im Audit-Lauf grün.
- 2026-03-15: Patch 451: PreviewScreen/PreviewFullscreen-Restprobleme konservativ behoben — `usePreview` nutzt content-basierte Fingerprints (Hot-Reload erkennt nun auch inhaltliche Same-Length-Edits), PreviewScreen nutzt dieselbe WebView-Crash-Recovery wie Fullscreen (inkl. one-shot Auto-Reload), und abgelaufene Supabase-URLs werden im normalen PreviewScreen nicht mehr blind in die WebView gegeben; Preview-Helper/Types dedupliziert, `previewFiles`-Dependency auf `projectData?.files` verengt, lokale HTML-Fallback-Transienz im UI klarer benannt.
- 2026-03-15: Patch 450: CustomHeader-/CI-Lite-Restfix konservativ umgesetzt — `useGitHubActionsLogs` resetet `workflowRun`/`logs` bei Input-Wechsel und verwirft verspätete Antworten per Request-Key-Guard; CI-Lite-Persistenz speichert nur noch für den aktiven CI-Lite-Run-Kontext (`workflowRun.id===runId` + Repo/Branch-Guard), Doppeltap-Dispatch ist blockiert, `head_sha` im `WorkflowRun`-Typ ergänzt, Artifact-JSON lokal typisiert, Patch-Sync ohne `as any` + `syncPatchToGitHub` via `useCallback` stabilisiert; gezielte Regressionen ergänzt.
- 2026-03-15: Patch 449: EnhancedBuildScreen-Restpunkte gezielt behoben — OneClickDeploy entfernt den redundanten Vorab-Push (SHA-sichere Reihenfolge bleibt im `startBuildJob`), `canStartBuildUi` wurde auf state-basiertes Inflight-Flag umgestellt, unnötige `openRunDetails`-Ref-Dependencies bereinigt und Build-/Logs-`WorkflowRun`-Typing inkl. `event` vereinheitlicht (`LogsAnalysisSection` ohne `any`).
- 2026-03-15: Patch 448: DiagnosticScreen-Restpunkte gezielt behoben — progressive Preflight-Progress nutzt wieder Severity-`stage`; „KI-Fix verfuegbar“ wird nicht mehr bei `pass`-Checks angezeigt; flow-nahe Typing-/Hook-Cleanups (`projectData`-Casts, Runner-`files`-Typing, Fix-Runner-Signaturen, Dependency-Vollständigkeit) plus fokussierte Regressionstests ergänzt.
- 2026-03-15: Patch 447: kleiner Edge-Typing-Follow-up umgesetzt; `_shared/auth` + `_shared/cors` lesen Runtime-Env jetzt ohne `globalThis as any`, `_shared/validation` reduziert verbleibende `any` in Trigger-/Dispatch-Validierung und `parseJsonBody` lehnt nicht-Objekt-JSON nun explizit mit Testabdeckung ab.
- 2026-03-15: Patch 446: Build-Start-Type-Safety gezielt nachgeschärft; riskante `any`-Zugriffe auf Edge-Invoke-Payload in `buildStartService` durch lokales Payload-Narrowing ersetzt, unnötigen `pushFilesToRepo`-Cast entfernt und mit Regressionstests (`job.id` + error-shaped payload) abgesichert.
- 2026-03-15: Patch 445: `save_preview`-Headerkonsistenz zu Auth-/Rate-Limit-Fehlerpfaden zusätzlich per Invariants abgesichert; `_shared/auth` nutzt nun Deno/Node-kompatiblen Env-Lookup statt harter Deno-Referenzen, wodurch der lokale Typecheck wieder grün läuft.
- 2026-03-15: Patch 444: `save_preview`-Restinkonsistenz bei CORS-/Security-Headern reduziert; lokale Erfolgs-/Fehlerantworten auf `_shared/cors` ausgerichtet, damit sie konsistenter zu Auth-/Rate-Limit-Fehlerpfaden reagieren; gezielte Invariant-Tests ergänzt.
- 2026-03-15: Patch 443: `k1w1-handler` Provider-Härtung für Restfälle umgesetzt — Anthropic verhindert leeres `messages`-Array bei reinen `system`-Prompts, Gemini mappt `system` explizit via `systemInstruction` und nutzt nicht-leeren `contents`-Fallback; doppeltes Gemini-Nullish-Coalescing entfernt, Invariant-Tests ergänzt.
- 2026-03-15: Patch 442: Build-Status-/Phasen-Feintuning im EnhancedBuildScreen umgesetzt; aktiver Lauf, letzte bekannte Build-Daten und Auswahl sauberer getrennt, aktive Phase expliziter markiert sowie Run/Artefakt/Download-Labels auf aktuellen vs. vergangenen Kontext geschärft (ohne Architekturänderung).
- 2026-03-15: Patch 441: konservatives Mikro-UX-Finetuning der Kernpfade Build/Diagnosis/Preview umgesetzt; Build- und Diagnose-CTAs alltagsnäher benannt, Preview-Statussprache auf Live/Fallback/Fehler vereinheitlicht, bestehende Readiness-/Guard-Logik unverändert gelassen.
- 2026-03-15: Patch 440: konservatives UX-/Flow-Feintuning (Build/Diagnosis/Preview/Connections/Credentials/Chat) mit Fokus auf klarere Status- und Fallback-Semantik ohne Architekturumbau; ergänzende Regression für Preview-Status-Text.
- 2026-03-15: Patch 438: Fragile Cross-Boundary-Imports in produktiven Supabase-Workflow-Edges entfernt (`../../../shared/constants/github.ts`); `GITHUB_API_BASE` edge-nah in `_shared/github.ts` verankert und per Invariant-Test gegen Regress abgesichert.
- 2026-03-15: Patch 437: Doppelte Preview-Migration (`20251226140000_fix_previews.sql`/`20251226160000_fix_previews.sql`) als byte-identische Redundanz bestätigt; spätere Migration als explizites Legacy-No-op markiert (kein History-Delete), um Doppel-Ausführung in frischen Setups und Wartungsirritation zu vermeiden.
- 2026-03-15: Patch 436: Migrations-/RPC-Hygiene für `insert_diagnostic_upload` finalisiert; historischen UUID-/Spalten-Drift (`repo/branch/mode/platform/report/meta`) explizit eingeordnet, finalen `jsonb -> bigint`-Vertrag per Abschlussmigration reassertet und mit Invariant-Test abgesichert.
- 2026-03-14: Patch 435: Großer Supabase-E2E-Vertragscheck (Preview, Workflow-Dispatch/Runs/Logs/Artifacts, Signing/Keystore, k1w1-Handler) finalisiert; verbleibende Operator-Schritte explizit dokumentiert und `github-run-artifact-json` ZIP-Pfadnormalisierung für `\`-Separatoren korrigiert (stabileres Artifact-JSON-Mapping).
- 2026-03-14: Patch 434: Supabase-E2E-Contract-Audit abgeschlossen; zentrale Supabase-Edge-Function-Konstanten für Signing/Preview/AI vervollständigt und Keystore-Wizard-Calls auf SoT-Constants migriert (Hardcode-Drift entfernt), Invariant-Tests ergänzt.
- 2026-03-14: Patch 433: End-to-End-Supabase-Contract-Audit über produktive Edge-Flows; stilles 200/ok:false-Drift-Risiko im Credentials-Wizard behoben (`invokeEdgeJson` mapped jetzt konsistent auf Fehlerzweig), Regressionstest ergänzt.
- 2026-03-14: Patch 432: Ownership-Audit-Härtung — zentrale Guard-Regeln für Template/Baseline vs. Chat vs. Diagnosis/Autofix eingeführt; Chat-Writeback auf kritische/template-nahe Pfade blockiert, Diagnosis/Autofix auf kuratierte Pfade begrenzt; Regressionstests für Ownership-Konflikte ergänzt.
- 2026-03-14: Patch 431: System-Audit-Fix — `diagnostic_last_ok` für Diagnosis→Build-Flow auf Repo/Branch scoped gemacht (legacy fallback bleibt), damit keine falsche Freigabe zwischen unterschiedlichen Selektionen entsteht.
- 2026-03-14: Patch 430: Live-Reachability-Audit für Groq/Gemini/OpenAI/Anthropic/HuggingFace mit realen Smoke-Requests; in dieser Umgebung alle Provider wegen fehlender Secrets nur als `missing_secret` klassifizierbar. k1w1-Handler-Fehlerverträge um provider+model-Kontext erweitert, Groq-Fallback gibt resolved Modell-ID zurück.
- 2026-03-14: Patch 429: KI-/Provider-Konfigurationsaudit — k1w1-Edge-Defaultmodelle auf app-konsistente aktuelle IDs aktualisiert (Gemini 2.5, Anthropic datierte IDs, HF Qwen), Groq-"groq/"-Kompatibilitätsfallback ergänzt, Invariant-Tests erweitert.
- 2026-03-14: Patch 428: Zweiter Korrektheits-Check durchgeführt; rote Suite auf `__tests__/oneClickDeploy.test.tsx` durch konservative Timeout-Stabilisierung im Test behoben (kein Produktionscode geändert).
- 2026-03-14: Patch 427: Supabase-Function-Flow-Audit — Keystore-Wizard-Edge-Aufrufe mit hartem Timeout und ehrlicher HTTP-Fehlerextraktion (JSON error/message + Details-Fallback) gehärtet.
- 2026-03-14: Patch 426: Chat/KI-Änderungsfluss konservativ gehärtet — Pending-Änderungen werden vor Persistenz auf den aktuellen Projektstand rebased; Zustandsdrift wird transparent im Chat signalisiert; Guard-Regressionstests ergänzt.
- 2026-03-14: Patch 425: Diagnosis/Autofix/One-Click-Kette konservativ gehärtet — One-Click blockiert jetzt explizit bei fehlender/grenzwertiger Readiness (Diagnostic, CI-Lite, Repo/Branch-Match, Freshness); mode-abhängige Pipeline-Filterlogik testbar gemacht.
- 2026-03-14: Patch 424: Supabase-Preview produktseitig als bevorzugter Browser-/WebView-Weg geschärft; klare URL-/Expiry-/Fallback-Kommunikation und QR-Aktion für bestehende Preview-URL ergänzt.
- 2026-03-14: Patch 423: Machbarkeits-Audit für Expo Web / QR-Web-Preview abgeschlossen; Empfehlung B (gezielte Vorarbeiten vor offizieller Aktivierung), Supabase-URL-Preview kurzfristig realistischer.
- 2026-03-13: Patch 422: E2E-Traceability gehärtet — Build-History-Updates nutzen für laufende Jobs eine job-gebundene Snapshot-Selektion (Repo/Branch/Profil) statt potenziell driftendem UI-Zwischenzustand.
- 2026-03-13: Patch 421: Build-Transparenz gehärtet — effektive Repo/Branch/Profil-Werte werden im Start-/Statusfluss konsistent in `currentBuild` + Historie getragen und im Build-Screen explizit angezeigt.
- 2026-03-13: Patch 420: Guard-/Invariant-Härtung gegen implizite Workflow-Ref-Fallbacks (`github.ref`, `github.ref_name`, `github.head_ref`, `default_branch`) in managed Deploy/Build-Flows; CI/CI-Lite-Ausnahme explizit abgesichert.
- 2026-03-12: Patch 419: Follow-up auf PR #206; `[EDGE_FUNCTIONS_STATUS](EDGE_FUNCTIONS_STATUS.md)` im Doku-Index wiederhergestellt und Patch-Benennung konsistent gehalten.
- 2026-03-12: Patch 418 V1 — Core-Doku auf Post-417-Realität gezogen, offene Restpunkte zentral in `docs/TODO.md` gesammelt, MD-/Notes-Cleanup als nächster Schritt fixiert.
- 2026-03-12: Patch 417 V18 — versehentlich committetes Patch-Artefakt aus dem Repo-Root entfernt, Patch-Bundle-/Patch-Datei-Artefakte per `.gitignore` gegen Re-Commit abgesichert.
- 2026-03-12: Patch 416 — stillgelegte Legacy-Lint-/Native-Sync-Edges auch in `supabase/config.toml` deaktiviert; Guard-/Invariant-Coverage ergänzt.
- 2026-03-11: Patch 414 V13 — Ref-SoT-Invariant robust gemacht (inkl. escaped Template-Dekodierung); dokumentierte branch-basierte CI-Lite-Ausnahme bewusst beibehalten.
- 2026-03-10: Patch 413 — restliche stille Repo-/Branch-Fallbacks in Build/Repo/Diagnostics/Diff/CI-Lite-Pfaden entfernt; Regression-Coverage ergänzt.
- 2026-03-10: Patch 412 — privilegierte Supabase-Funktionen gehärtet (`search_path`, `PUBLIC`-Execute-Revoke) + Guard-/Invariant-Coverage.
- 2026-03-10: Patch 411 V7 — Supabase-Deploy auf `workflow_dispatch` + expliziten `ref` gehärtet; `_shared`-/Single-Function-Guards und Migrations-Policy synchronisiert.
- 2026-03-09: Patch 410/410B — Edge-Auth-Pfade getrennt, explizite CI-Bearer-Guards ergänzt, Service-Role-Handhabung aus Client-Pfaden entfernt.
- 2026-03-09: Patch 409/408 — Upload-ID-Vertrag als opaque string stabilisiert; Build-Job-Vertrag auf positive numerische `jobId` ausgerichtet.

## Hinweise

- Vollständige Historie: `docs/patches/PATCHLOG_ROOT.md`.
- Operative Restliste / Follow-ups: `docs/TODO.md`.
- 2026-03-15: Patch 459: Chat-Regression aus PR #272 konservativ geschlossen — Meta-/lokale Kommandos werden wieder gegen unveränderten Raw-Input geprüft; Attachment-Hinweis wird erst nach Command-Routing für den normalen AI-Request angehängt; gezielte Invariant-Regression ergänzt; Workflow-/Typecheck-/Lint-/Tests grün.
- 2026-03-15: Patch 458: ChatScreen/Chat-Flow Restpunkte konservativ geschlossen: ehrlicher Attachment-Hinweis (kein verdeckter Dateiinhalt-Anspruch), Retention-Pruning direkt beim Chat-Append, Blur-Cleanup für Pending/Modal/Streaming-State sowie typing-/import-Hygiene in chatAIFlow-Types; Verifikation mit Workflow-Checks + Typecheck/Lint/Test vollständig grün.
