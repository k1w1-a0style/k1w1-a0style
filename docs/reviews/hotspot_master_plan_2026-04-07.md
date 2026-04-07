# Hotspot Master Plan — Struktur-/Wartbarkeitsblock

Stand: **2026-04-07 (Patch 759, Analyse-only ohne Grossumbau)**

## 1) Gesamturteil

Der Repo-Stand ist funktional deutlich stabilisiert, aber es bleiben klar identifizierbare **Wartbarkeits-Hotspots** mit hoher Regressionsflaeche durch Mischverantwortung (UI + State + IO + Persistenz in einzelnen Modulen). Die groessten technischen Hebel sind aktuell:

1. `contexts/ProjectContext.tsx` (zentraler Kontext-Monolith),
2. `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts` (starke IO-/Persistenzmischung),
3. `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts` (Dispatch + Lookup + Artifact + Persistenz),
4. `screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx` und `SecretsSection.tsx` (UI/IO/Domain-Logik in je einer Komponente),
5. `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts` (Screen-Orchestrierung + Run-State + Selection-Race-Schutz).

## 2) Vollstaendige Hotspot-Liste (bestaetigt)

Bestaetigte, bereits bekannte Rest-Hotspots:
- ConnectionsScreenRefactor
- ProjectContextRefactor
- LocalRemoteDiffSectionRefactor
- SecretsSectionRefactor
- CiLiteWorkflowFurtherSplit
- DiagnosticScreenFurtherSplit

Zusatz-Hotspots im selben Scope (echte strukturelle Wartbarkeitsarbeit, kein Bug-Hunt):
- `hooks/useChatAIFlow.ts` (groesser Orchestrierungs-Hook, bereits in Risiko-Audit als B-Hotspot gefuehrt)
- `shared/workflows/managedWorkflowTemplates.ts` (sehr grosse Vertrags-/Template-Datei mit hoher Drift- und Review-Last)

## 3) Zerlegeplan pro Hotspot

### ConnectionsScreenRefactor

- Betroffene Datei(en):
  - `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`
  - `screens/ConnectionsScreen/index.tsx`
- Warum Hotspot:
  - Sehr grosse Hook-Datei (~1179 LoC) mit vielen Verantwortungen (Hydration, Persistenz, Provider-Checks, Token-Handling, EAS-Link-Flow, Busy-Guard, UI-Toggles).
  - `index.tsx` ist schon teilkomponentenbasiert, haengt aber an einer sehr breiten Hook-API.
- Vollstaendige Zerlegung geplant: **Ja**
- Zielstruktur:
  - alte Datei:
    - `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`
  - neue Ziel-Dateien:
    - `screens/ConnectionsScreen/hooks/useConnectionsHydration.ts` → initiales Laden/Reset von Tokens, Lichtern, Persistenz-Snapshots.
    - `screens/ConnectionsScreen/hooks/useConnectionsProviderTests.ts` → `testGitHub`, `testSupabase`, `testExpo`, `testEas` inkl. Fehlermapping.
    - `screens/ConnectionsScreen/hooks/useConnectionsSecretsState.ts` → lokale Secret-/Visibility-State-Slices (GitHub/Expo/Admin/Supabase).
    - `screens/ConnectionsScreen/hooks/useConnectionsEasLink.ts` → `onLinkExisting`, `onCreateAndLink`, EAS-Verifikation/-Persistenz.
    - `screens/ConnectionsScreen/hooks/useConnectionsBusyAction.ts` → Busy-Guard/guarded actions als wiederverwendbares Mini-FSM.
    - `screens/ConnectionsScreen/hooks/connections.types.ts` → Hook-Contracts und DTOs.
- Container/Orchestrator nach Refactor:
  - `useConnectionsScreen.ts` bleibt als **duenner Orchestrator**, komponiert nur Teil-Hooks + Return-Model.
- Risiko beim Umbau:
  - Race Conditions (Busy-Guard + async tests),
  - versehentliches Aendern von Persistenz-Reihenfolgen,
  - UX-Regression bei Status-Lichtern/EAS-Verifikationszustand.
- Empfohlene Refactor-Schritte:
  1. Nur Types + Return-Contract extrahieren (no behavior change).
  2. Hydration/Persistenz als erstes auslagern (stabilster, testbarer Block).
  3. Provider-Tests und EAS-Link getrennt auslagern.
  4. Restliches UI-State in kleinen Slice-Hook verschieben.
  5. Haupt-Hook auf Orchestrator reduzieren.
- Welche Tests/Checks schuetzen den Umbau:
  - `__tests__/connectionsScreen.screen.test.tsx`
  - `__tests__/connectionsScreen.flowGuards.invariants.test.ts`
  - `__tests__/connectionsScreen.validation.test.ts`
  - `__tests__/connectionsScreen.statusCardSemantics.test.tsx`
  - `__tests__/useConnectionsScreenHelpers.test.ts`
  - `__tests__/useConnectionsScreenProviderChecks.test.ts`

### ProjectContextRefactor

- Betroffene Datei(en):
  - `contexts/ProjectContext.tsx`
  - bereits vorhandene Hilfsdateien `projectContext*Helpers.ts`
- Warum Hotspot:
  - Zentraler Monolith (~937 LoC), vereint Persistenz-Scheduling, Build-Start/Polling, Chat-Retention, Projektmutationen, Export/Import und Context-Value-Komposition.
- Vollstaendige Zerlegung geplant: **Teilweise**
- Zielstruktur:
  - alte Datei:
    - `contexts/ProjectContext.tsx`
  - neue Ziel-Dateien:
    - `contexts/projectContext/useProjectPersistenceController.ts` → Hydration, Save-Debounce, Recovery-mode write blocking.
    - `contexts/projectContext/useProjectBuildController.ts` → Build start/poll synchronization + history update paths.
    - `contexts/projectContext/useProjectChatRetention.ts` → retention hydrate/sanitize/trim lifecycle.
    - `contexts/projectContext/useProjectFileCommands.ts` → file CRUD/import/export wrappers (pure command adapters).
    - `contexts/projectContext/projectContext.contracts.ts` → interne command/result contracts.
- Container/Orchestrator nach Refactor:
  - `ProjectContext.tsx` bleibt bewusst als **einziger Provider-Orchestrator** (kein Multi-Provider-Sprung in dieser Welle).
- Risiko beim Umbau:
  - Hohe Vertragsnaehe fuer Persistenz-/Recovery-/Build-Pfade,
  - Gefahr von subtilen Reihenfolgefehlern beim Save-Scheduler,
  - Context-value identity / rerender semantics.
- Empfohlene Refactor-Schritte:
  1. Nur interne Controller-Hooks einfuehren, Aufrufreihenfolge unveraendert lassen.
  2. Persistence-Controller extrahieren.
  3. Build-Controller extrahieren.
  4. Chat-retention + file-commands extrahieren.
  5. Provider-Datei als orchestrator-only konsolidieren.
- Welche Tests/Checks schuetzen den Umbau:
  - `__tests__/projectContext.retentionHydrationGuard.test.ts`
  - `__tests__/projectContext.messagesReference.invariants.test.ts`
  - `lib/__tests__/buildStartService.integration.test.ts`
  - `__tests__/buildReadinessGate.diagnosticLastOk.test.ts`
  - `__tests__/projectMaterializer.failSafe.regression.test.ts`

### LocalRemoteDiffSectionRefactor

- Betroffene Datei(en):
  - `screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx`
- Warum Hotspot:
  - Sehr grosse Komponente (~943 LoC) mit UI, Diff-Algorithmen (LCS), Caching, Async-Loads, Preview-/Inline-Modal-State in einem File.
- Vollstaendige Zerlegung geplant: **Ja**
- Zielstruktur:
  - alte Datei:
    - `screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx`
  - neue Ziel-Dateien:
    - `screens/GitHubReposScreen/components/LocalRemoteDiffSection/index.tsx` → Container/UI-Orchestrator.
    - `screens/GitHubReposScreen/components/LocalRemoteDiffSection/useLocalRemoteDiffModel.ts` → Laden, Selektion, stale-request guards, preview cache.
    - `screens/GitHubReposScreen/components/LocalRemoteDiffSection/diffAlgorithms.ts` → `unifiedLineDiff`, `compactUnifiedDiff`, line-style helpers.
    - `screens/GitHubReposScreen/components/LocalRemoteDiffSection/fingerprint.ts` → local fingerprint/hash helpers.
    - `screens/GitHubReposScreen/components/LocalRemoteDiffSection/LocalRemoteDiffList.tsx` → reine Diff-Liste + Selection-UI.
    - `screens/GitHubReposScreen/components/LocalRemoteDiffSection/DiffPreviewModal.tsx` → Preview-Modal rendering.
    - `screens/GitHubReposScreen/components/LocalRemoteDiffSection/types.ts` → `DiffItem`, `PreviewCacheEntry`, request model.
- Container/Orchestrator nach Refactor:
  - `index.tsx` als UI-Container; Modell-/IO steckt in `useLocalRemoteDiffModel`.
- Risiko beim Umbau:
  - Diff-Ausgabe darf sich semantisch nicht veraendern,
  - stale-response guards duerfen nicht verloren gehen,
  - performance regressions bei grossen Dateien.
- Empfohlene Refactor-Schritte:
  1. Pure Diff-/Fingerprint-Helfer unveraendert auslagern + tests.
  2. Preview-Modal als reine UI-Komponente auslagern.
  3. Async model hook extrahieren.
  4. Container auf orchestration-only reduzieren.
- Welche Tests/Checks schuetzen den Umbau:
  - `__tests__/githubReposScreen.list.test.tsx`
  - `__tests__/githubReposScreen.pullPushSemantics.test.ts`
  - `__tests__/patch462.githubReposScreen.restFixes.invariants.test.ts`
  - `__tests__/patch483.githubReposScreen.step8.invariants.test.ts`

### SecretsSectionRefactor

- Betroffene Datei(en):
  - `screens/GitHubReposScreen/components/SecretsSection.tsx`
- Warum Hotspot:
  - ~706 LoC, mischt secret-list fetch, runtime credential presence checks, contract derivation und UI-Raster.
- Vollstaendige Zerlegung geplant: **Ja**
- Zielstruktur:
  - alte Datei:
    - `screens/GitHubReposScreen/components/SecretsSection.tsx`
  - neue Ziel-Dateien:
    - `screens/GitHubReposScreen/components/SecretsSection/index.tsx` → Container.
    - `screens/GitHubReposScreen/components/SecretsSection/useRepoSecretsVerification.ts` → list fetch + stale/auth/error state.
    - `screens/GitHubReposScreen/components/SecretsSection/useRuntimeCredentialPresence.ts` → lokale token/admin-key presence checks.
    - `screens/GitHubReposScreen/components/SecretsSection/secretsSectionContracts.ts` → required/optional/runtime row composition.
    - `screens/GitHubReposScreen/components/SecretsSection/SecretsSummaryCard.tsx` → Summary UI.
    - `screens/GitHubReposScreen/components/SecretsSection/SecretsChecklist.tsx` → Required/Optional rows UI.
    - `screens/GitHubReposScreen/components/SecretsSection/RuntimeCredentialsCard.tsx` → Runtime vs Repo contract UI.
- Container/Orchestrator nach Refactor:
  - `index.tsx` als Container; data derivation in hooks/contracts.
- Risiko beim Umbau:
  - Regression bei „stale vs verified vs auth_error“ Zustandslogik,
  - Verwechslung zwischen lokalen Credentials und Repo-Secret-Namen.
- Empfohlene Refactor-Schritte:
  1. Contracts/Row-Derivations pure extrahieren.
  2. Runtime-presence Hook extrahieren.
  3. Repo-secret verification Hook extrahieren.
  4. UI-Karten splitten.
- Welche Tests/Checks schuetzen den Umbau:
  - `__tests__/githubReposScreen.secretsSectionSemantics.test.tsx`
  - `__tests__/pipelineDiagnostics.secretContractSemantics.test.ts`
  - `__tests__/patch410.secretContainment.invariants.test.ts`

### CiLiteWorkflowFurtherSplit

- Betroffene Datei(en):
  - `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`
- Warum Hotspot:
  - ~857 LoC; kombiniert Dispatch/Auth, run lookup correlation, artifact retrieval, persistence hydration und Header-UI-state.
- Vollstaendige Zerlegung geplant: **Teilweise**
- Zielstruktur:
  - alte Datei:
    - `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`
  - neue Ziel-Dateien:
    - `components/CiLiteHeaderButton/hooks/useCiLiteDispatch.ts` → dispatch + operator access + start metadata.
    - `components/CiLiteHeaderButton/hooks/useCiLiteRunLookup.ts` → polling/lookup FSM + match diagnosis.
    - `components/CiLiteHeaderButton/hooks/useCiLiteArtifactFetch.ts` → artifact fetch/parse/retry semantics.
    - `components/CiLiteHeaderButton/hooks/useCiLitePersistence.ts` → hydration/persisted snapshot sync.
    - `components/CiLiteHeaderButton/hooks/ciLiteWorkflow.types.ts` → orchestrator contracts/events.
- Container/Orchestrator nach Refactor:
  - `useCiLiteWorkflow.ts` bleibt als orchestrierender public hook.
- Risiko beim Umbau:
  - Timing-/correlation-Regressions (falscher Run gematcht),
  - Auth-/Admin-Key-Vertrag darf nicht verwässert werden,
  - Chain-run Verhalten (autofix -> ci-lite) sensibel.
- Empfohlene Refactor-Schritte:
  1. Persistence-Hydration und artifact fetch als erste, klar begrenzte Schnitte.
  2. Lookup-FSM extrahieren (mit unveraenderten Guards).
  3. Dispatch/auth block extrahieren.
  4. Haupthook auf Event-Orchestrierung reduzieren.
- Welche Tests/Checks schuetzen den Umbau:
  - `__tests__/useCiLiteWorkflowHelpers.test.ts`
  - `__tests__/ciLitePatch.invariants.test.ts`
  - `__tests__/ciLiteHeaderWorkflow.invariants.test.ts`
  - `__tests__/patch604.workflowOperatorCallerContract.invariants.test.ts`

### DiagnosticScreenFurtherSplit

- Betroffene Datei(en):
  - `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts`
  - `screens/DiagnosticScreen/index.tsx`
- Warum Hotspot:
  - Hook ~608 LoC trotz bereits ausgelagerter Runner-Helfer; enthaelt weiterhin Run-Orchestrierung, Preferences, Selection scope invalidation, Fix-Runner wiring und UI state.
- Vollstaendige Zerlegung geplant: **Teilweise**
- Zielstruktur:
  - alte Datei:
    - `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts`
  - neue Ziel-Dateien:
    - `screens/DiagnosticScreen/hooks/useDiagnosticRunController.ts` → run lifecycle, stage/progress, epoch/scope guards.
    - `screens/DiagnosticScreen/hooks/useDiagnosticResultsModel.ts` → sorting/counts/filter projection.
    - `screens/DiagnosticScreen/hooks/useDiagnosticUiState.ts` → tab/accordion/modal toggles.
    - `screens/DiagnosticScreen/hooks/useDiagnosticActions.ts` → runDiagnostics/smartFix/openIssue/openPreview glue.
    - `screens/DiagnosticScreen/hooks/diagnosticScreen.contracts.ts` → state/action contracts.
- Container/Orchestrator nach Refactor:
  - `useDiagnosticScreen.ts` bleibt public facade hook.
- Risiko beim Umbau:
  - Scope-invalidation regressions (stale results im falschen repo/branch scope),
  - Fix-runner integration regressions,
  - autoRun route-parameter side effects.
- Empfohlene Refactor-Schritte:
  1. Results-model pure extrahieren.
  2. UI-state slice extrahieren.
  3. Run-controller (epoch/scope) in eigenen Hook ziehen.
  4. Actions wiring final konsolidieren.
- Welche Tests/Checks schuetzen den Umbau:
  - `__tests__/useDiagnosticScreenHelpers.test.ts`
  - `__tests__/useDiagnosticScreen.scopeInvalidation.test.tsx`
  - `__tests__/diagnosticScreen.selectionScopeInvalidation.invariants.test.ts`
  - `__tests__/diagnosticScreen.runScopeRace.invariants.test.ts`
  - `__tests__/useDiagnosticFixRunner.integrationFlow.test.tsx`

### Zusatz-Hotspot: ChatAIFlowFurtherSplit

- Betroffene Datei(en):
  - `hooks/useChatAIFlow.ts`
- Warum Hotspot:
  - Sehr grosse Orchestrierungslogik (~781 LoC in aktuellem Stand), viele Entscheidungspfade (planner/builder/guard/reply composition).
- Vollstaendige Zerlegung geplant: **Nein**
- Zielstruktur:
  - alte Datei:
    - `hooks/useChatAIFlow.ts`
  - neue Ziel-Dateien:
    - `hooks/chatAIFlow/intentRouting.ts` → intent/scout/direct-build routing.
    - `hooks/chatAIFlow/replyComposer.ts` → response summary/text assembly.
    - `hooks/chatAIFlow/guardExplainers.ts` → guard/policy hint composition.
- Container/Orchestrator nach Refactor:
  - `useChatAIFlow.ts` bleibt bewusst zusammenhaengender orchestration-hook.
- Risiko beim Umbau:
  - Prompt-/intent-regressions sind schwer visuell zu erkennen,
  - hohe Test-Matrix und versteckte behavior shifts.
- Empfohlene Refactor-Schritte:
  1. Nur pure text/intent helpers extrahieren.
  2. Keine state-machine-Aufteilung in dieser Welle.
  3. Nach jedem kleinen Schnitt focused regression-run.
- Welche Tests/Checks schuetzen den Umbau:
  - `__tests__/chatHeuristics.plannerRouting.test.ts`
  - `__tests__/useChatAIFlow.summary.regression.test.ts`
  - `__tests__/chatScreen.flowTruthfulness.invariants.test.ts`

### Zusatz-Hotspot: ManagedWorkflowTemplatesMaintainability

- Betroffene Datei(en):
  - `shared/workflows/managedWorkflowTemplates.ts`
- Warum Hotspot:
  - ~845 LoC in einer Vertragsdatei mit hoher Fehler- und Drift-Wirkung (workflow YAML-/template-Strings, writeback guards).
- Vollstaendige Zerlegung geplant: **Ja**
- Zielstruktur:
  - alte Datei:
    - `shared/workflows/managedWorkflowTemplates.ts`
  - neue Ziel-Dateien:
    - `shared/workflows/templates/easBuildTemplate.ts` → eas-build template content + marker contracts.
    - `shared/workflows/templates/releaseBuildTemplate.ts` → release template content + marker contracts.
    - `shared/workflows/templates/ciLiteAutofixTemplate.ts` → ci-lite autofix template content.
    - `shared/workflows/templates/easLinkTemplate.ts` → eas-link template content.
    - `shared/workflows/templateContracts.ts` → shared branch/writeback/permission markers.
    - `shared/workflows/managedWorkflowTemplates.ts` → nur Aggregator-Export + registry mapping.
- Container/Orchestrator nach Refactor:
  - `managedWorkflowTemplates.ts` bleibt registry-orchestrator.
- Risiko beim Umbau:
  - Marker-/contract checks duerfen nicht brechen,
  - versehentliche Template-Drift zwischen shared/template checks.
- Empfohlene Refactor-Schritte:
  1. Nur Datei-Split ohne Inhaltsaenderung (byte-identische strings).
  2. Aggregator mit stabilen exports.
  3. Workflow-/drift scripts + invariants gruene bestaetigen.
- Welche Tests/Checks schuetzen den Umbau:
  - `bash scripts/check_managed_workflows.sh`
  - `bash scripts/check_workflow_template_drift.sh`
  - `bash scripts/check_patch_docs_sync.sh`
  - `__tests__/patch414.workflowRefSot.invariants.test.ts`
  - `__tests__/patch600.workflowAdminScriptContract.invariants.test.ts`

## 4) Priorisierung (empfohlene Reihenfolge)

1. **ConnectionsScreenRefactor** — hoechster Nutzen/Risiko-Quotient: sehr grosser Hook, klares Schnittmodell, gute bestehende Tests.
2. **LocalRemoteDiffSectionRefactor** — einzelner UI-Monolith mit klar trennbaren pure Diff-Helfern.
3. **SecretsSectionRefactor** — eng benachbarter GitHubRepos-Bereich, gleiche Testdomae ne, gute Folgeeffizienz nach Diff-Split.
4. **CiLiteWorkflowFurtherSplit** — hochrelevant, aber timing-/auth-sensibel; nach den UI-Splits angehen.
5. **DiagnosticScreenFurtherSplit** — mittel-hohes Risiko, gute Guards vorhanden; nach CiLite.
6. **ProjectContextRefactor** — technisch wichtig, aber aufgrund zentraler Vertragsnaehe spaeter und in kleinsten Schnitten.
7. **ManagedWorkflowTemplatesMaintainability** — strukturell sinnvoll, aber nur mit starker invariant-Absicherung.
8. **ChatAIFlowFurtherSplit** — bewusst konservativ als letzte, selektive helper-first Runde.

## 5) Umsetzungsempfehlung

Klare Empfehlung: **hotspotweise nacheinander, und innerhalb jedes Hotspots mehrstufig in kleinen Runden**.

Nicht parallel, weil:
- dieselben Kern-Contracts (selection scope, workflow guards, persistence) sonst gleichzeitig bewegt werden,
- Review-/Regression-Signale bei Parallelumbauten stark verrauschen,
- die vorhandenen Invariant-Tests hotspotweise eine klare Safety-Line liefern.

Technisch sichere Kadenz:
1. Hotspot waehlen,
2. nur ein klarer Teilschnitt (types/pure helpers/model hook),
3. fokusierte Tests,
4. erst dann naechster Teilschnitt.

## 6) Erste Umsetzungsrunde empfohlen

**Erster Hotspot: `ConnectionsScreenRefactor` (Schritt 1: Contracts + Hydration-Split).**

Begruendung:
- groesster verbleibender A-Hotspot in App-UI-Naehe,
- bereits helper-first vorbereitet,
- hohe Wartbarkeitsrendite bei kontrollierbarem Risiko,
- starke bestehende Regression- und Semantik-Tests vorhanden.
