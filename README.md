# k1w1-a0style

## Schnellstart Doku

- Einstieg / Navigationsknoten: `docs/INDEX.md`
- Operatives Gesamtbild: `docs/00-overview.md`
- Offene Punkte (laufend): `docs/TODO.md`
- Patch-Ablauf: `docs/WORKFLOW_PATCHING.md`
- Patchlog (append-only): `docs/patches/PATCHLOG_ROOT.md`
- Kurz-Checklog (laufend): `PROJECT_CHECKLOG.md`

## Aktueller Stand (kompakt)

- Zuletzt abgeschlossen: **Patch 476**.
- Workflow-/CI-Lite-SoT ist nach 393A–417 konsolidiert; Drift-Guards und Invariants sind dafür etabliert.
- Patch 476 schließt verbleibende UX-/Flow-Consistency-Restpunkte zwischen Verbindungen, Repo und Build konservativ: Build-Gates verweisen jetzt konsistent auf den GitHub-Repos-Screen, Secret-Sync-Kommunikation bildet den real app-verwalteten Umfang inkl. manueller Production-Grenze (Service-Role-Key) ehrlich ab, und die EAS-Rollen sind sprachlich klar getrennt (Verbindungen = Token/ID, Repo = Link/Workflow im Ziel-Repo).
- Patch 475 härtet verbleibende Persistenz-/ProjectContext-Restpunkte minimal: `saveProjectToStorage` hat jetzt einen klaren UTF-8-Size-Guard mit Soft-/Hard-Limit-Warnung bzw. hartem Fail vor `AsyncStorage.setItem`, und `ProjectContext.messages` nutzt eine memoized `contextMessages`-Referenz auf Basis von `projectData.chatHistory`, um unnötige Array-Referenzwechsel bei projectData-Updates zu reduzieren.
- Patch 474 ergänzt gezielte Wiring-Invariants für den Timeout-Hauptrestpunkt: der Chat-AI-Flow bleibt regressionsfest auf `runOrchestratorWithHardTimeout(...)` verdrahtet (Planner/Builder/Validator/Explain, inkl. Builder-Retry) und verhindert direkte `runOrchestrator(...)`-Rückfälle im `processAIRequest(...)`-Block.
- Patch 473 schließt den verbleibenden Hauptrestpunkt im Chat-AI-Flow: Planner/Builder/Validator/Explain verwenden jetzt jeweils einen echten harten Stage-Timeout (`45s`) mit aktivem Abort des hängenden `runOrchestrator(...)`-Calls über die bestehende AbortController-Struktur.
- Patch 472 schließt den letzten Timeout-Detailrest aus 471: harte Orchestrator-Timeouts werden im Ergebnis jetzt explizit als `timeout` ausgewiesen, während externe/usergetriebene Abbrüche weiterhin sauber als `abgebrochen` klassifiziert bleiben (keine Änderung am Retry-/Provider-Design).
- Patch 471 zieht verbleibende AI-/Request-Robustheitsreste minimal nach: `runOrchestrator` erzwingt jetzt ein hartes Request-Timeout pro Provider-Call (45s, inklusive sauberer Abort-Weitergabe), Key-Rotation-Retries warten kurz per kleinem Backoff (350ms) statt sofort zu feuern, und der Builder-Retry im Chat-Flow hat einen konservativen Backoff (700ms) bei 429/503/Timeout-/Netzwerkpfaden.
- Patch 470 vervollständigt den verbleibenden `k1w1-handler`-Restpunkt aus 469: auch der frühe `parseJsonBody(...)`-Fehlerpfad nutzt jetzt ausschließlich generische sichere Client-Fehler (`Invalid request payload.` / `Request too large.`) statt roher `parsedBody.error`-Durchreichung; der Catch-Block ist minimal auf `unknown` + Narrowing gehärtet.
- Patch 469 härtet die verbleibenden bestätigten Security-/Exposure-Restpunkte in Edge-/Preview-Pfaden minimal-konservativ: `preview_page` rendert Runtime-Errors ohne HTML-Interpolation (kein Stack-/HTML-Injection-Pfad mehr), und `k1w1-handler` gibt Clients nur noch generische sichere Fehlertexte statt roher interner `err.message`-Details zurück.
- Patch 468 schließt den letzten bestätigten GitHubReposScreen-Architekturblock konservativ: Sync-Vergleich läuft zentral über Tree-SHA statt teurem per-file Contents-Loop, Push nutzt den Git Data API-Pfad (ein konsolidierter Commit statt N Datei-Commits), und der bestehende Repo-/Branch-Race-Guard bleibt unverändert aktiv.
- Patch 467 entschärft den verbleibenden allgemeinen Maintenance-/Typing-Block bewusst klein: flow-nahe `any`-Reste in Chat-/Logs-/Storage-Helfern wurden lokal typisiert, ein toter Import in `useGitHubActionsLogs` entfernt und die Edge-Fehlerpayload-Parse enger gemacht — ohne Architekturumbau.
- Preview-Restfix ist konservativ abgeschlossen: Hot-Reload nutzt content-basierte File-Fingerprints (kein Same-Length-Blindspot mehr), der normale PreviewScreen hat jetzt dieselbe WebView-Crash-Recovery wie Fullscreen, und abgelaufene Supabase-URLs werden im PreviewScreen nicht mehr blind geladen.
- KI-/Chat-/Prompting-Restpunkte wurden konservativ gehärtet: Projekt-Snapshot priorisiert jetzt relevante Dateien statt reiner Array-Reihenfolge, Builder-NonJSON-Antworten werden als verständliche KI-Rückmeldung angezeigt (statt kryptischem Parserfehler), Drift-Digest nutzt SHA-256 über Pfad+Inhalt (kein Same-Length-Blindspot), und Nutzerfeedback zeigt geblockte/übersprungene Ownership-/Validator-/Explain-Fälle transparenter.
- Nachaudit (Patch 453): Non-JSON-Fehlerpfad wurde für `output_text`-Antworten wirklich transparent gemacht (Response-Preview bleibt erhalten statt Generic-Fehler), und die Normalizer-Regressionstests decken diesen Randfall jetzt explizit ab.
- Test-Stability-Nachaudit (Patch 454): Der flakige OneClickDeploy-Test ist jetzt deterministischer entkoppelt (expliziter `act`-Press-Helper + Microtask-Flush, AsyncStorage-Defaults pro Test, konsequentes Cleanup mit Timer-Clear), wodurch sporadische Timeout-Rennen in `__tests__/oneClickDeploy.test.tsx` reduziert werden, ohne Produktcode-Umbau.
- ConnectionsScreen-Restpunkte (Patch 455) sind konservativ geschlossen: Supabase-ANON-Key wird jetzt konsistent über SecureStore (mit Legacy-Migration) gehalten, parallele Save/Test-Runs sind über Busy-/Hydration-Guards blockiert, Expo-Test persistiert Tokens nicht mehr als versteckten Side-Effect, und EAS-Link-Start setzt die Lampe nicht mehr optimistisch auf grün.
- Patch 456 ergänzt eine explizite RN-Runtime-Guardrail im Chat-Drift-Digest-Pfad: keine Node-`crypto`-Imports in `lib/chatFlowStateGuards.ts`, damit Mobile-Bundles ohne Metro-Polyfill stabil bleiben.
- Patch 457 behebt den offenen Busy-Guard-Restpunkt im Connections-Flow: Busy-Kollisionen und echte Save/Test-Fehler sind jetzt sauber getrennt (dedizierter Busy-Error statt booleschem Rückgabewert), dadurch erscheint der Busy-Hinweis nur noch bei echter Konkurrenz; die kritische Pending-Plan-Guard-Logik in `useChatAIFlow` wurde gezielt verifiziert und per Invariant gegen Drift abgesichert.
- Patch 459 zieht den offenen Restpunkt aus PR #272 nach: Meta-/lokale Full-line-Kommandos (`cat <pfad>`, `zeige datei <pfad>`) laufen wieder auf unverändertem Raw-Input; der Attachment-Hinweis wird erst nach dem Command-Routing im normalen AI-Request berücksichtigt.
- Patch 460 schließt den verbleibenden PR-#273-Restpunkt: `handleSendWithMeta(...)` bricht nur noch ab, wenn sowohl Raw- als auch AI-Input leer sind; dadurch laufen Attachment-only-Sendefälle wieder deterministisch in den normalen AI-Pfad, während Meta-Kommandos weiterhin ausschließlich auf dem unveränderten Raw-Input geprüft werden.
- Patch 461 zieht die beiden verbliebenen Chat-Regressionen aus PR #272/#273 gemeinsam final gerade: Meta-/lokale Kommandos bleiben strikt auf unverändertem `rawInput`, der Attachment-Hinweis fließt nur in den normalen AI-Request, und auch im Pending-Plan-Handoff gehen Attachment-only-Details (`aiInput`) nicht verloren.
- Patch 464 zieht den verbliebenen defensiven Restpunkt nach: lokale `project.files` laufen im GitHubReposScreen zentral über einen getypten Normalizer, der `null`/malformed Legacy-Einträge herausfiltert; dadurch crashen Normalizer-/Iterationen im RepoScreen-Pfad nicht mehr bei kaputten Storage-Daten.
- Patch 465 schließt die verbliebenen SettingsScreen/AIContext-Restpunkte minimal-konservativ: leeres Retention-Input wird im Save-Pfad nicht mehr still als `0` gespeichert (explizit ungültig), verspätete Retention-Hydration im `ProjectContext` überschreibt keine frisch gesetzten Runtime-Werte mehr, und der kleine `moveKeyToFront`-Fallback ist ohne Logikänderung leicht bereinigt; gezielte Regressionstests decken beide Kernpfade ab.

- CodeScreen-Restblock ist minimal nachgezogen: WebCodeEditor hat jetzt dieselbe One-Shot-WebView-Crash-Recovery-Verdrahtung (`onContentProcessDidTerminate`/`onRenderProcessGone`) wie der Preview-Shared-Pattern, Folder-Delete nutzt batched `deleteFiles(...)` statt sequentiellem Einzel-Delete, und der Delete-Handler ist explizit gegen fehlendes Target gehärtet; gezielte Regressionstests decken Recovery-Wiring und FileActions-Guards ab.

- Patch 462 schließt die bestätigten GitHubReposScreen-Restpunkte konservativ: Root-`projectData.files` läuft ohne `any[]`-Root-Cast als `ProjectFile[]`, `refreshSyncStatus` hat nun einen Run-Guard gegen stale Async-Rückläufer bei Repo-/Branch-Wechsel, und `handleCreateRepo` übernimmt den von GitHub gelieferten `default_branch` sofort statt blind auf `null` zu setzen; angrenzende Pull-/Push-Casts wurden im selben Hook minimal reduziert.

- Patch 463 schließt bestätigte SettingsScreen/AIContext-Restpunkte minimal-konservativ: Quality-Mode schaltet jetzt die effektiven Chat-/Agent-Modelle direkt mit, Retention-Limit ist in der Privacy-Section ehrlich editierbar (inkl. Persistenz), Gemini-Key-Prefix-Validation (`AIza`) ist ergänzt, und unnötige `any`-Hotspots im Settings-Hook/Provider-Status-Flow wurden reduziert; gezielte Tests sichern Quality-Mode-Mapping sowie Settings-Helper ab.
- CustomHeader/CI-Lite-Restfix ist konservativ nachgezogen: Logs/Run-State resetten bei Input-Wechsel, verspätete Responses werden per Request-Key-Guard abgefangen, Persistenz schreibt nur noch für den aktiven CI-Lite-Run-Kontext (kein Autofix→CI-Lite-Fehlpersist), und Doppeltap-Dispatch wird geblockt.
- Build-Job-Vertrag ist auf **positive numerische `jobId`** (bigint-backed) ausgerichtet; UUID-Annahmen sind entfernt.
- Edge-Shared-Validation/Auth/CORS haben einen kleinen Deno/Node-Typing-Follow-up: Runtime-Env-Lookup ohne `any`, Request-Validation mit engeren Objekt-/Union-Typen (kein Broad-Refactor).
- DiagnosticScreen-Restpunkte sind konservativ nachgezogen: progressive Severity-Anzeige im Preflight-Fortschritt ist korrekt, KI-Fix-Hinweise sind für grüne `pass`-Checks nicht mehr irreführend, und flow-nahe Typing-/Hook-Lücken im selben Screen wurden ohne Broad-Refactor geschlossen.
- EnhancedBuildScreen-OneClickDeploy ist SHA-robuster: kein Vorab-Push mehr im OneClick-Flow (Sync-/Push-Entscheidung bleibt zentral im Build-Start), wodurch künstliche SHA-Mismatch-/Doppel-Push-Risiken reduziert sind.
- Diagnostics-Upload-ID wird clientseitig als **opaque string** behandelt; SQL-Seite bleibt bigint-backed.
- Diagnostics-RPC `insert_diagnostic_upload` ist migrationsseitig als finaler `jsonb -> bigint`-Vertrag reassertet; historischer UUID-/Spalten-Drift bleibt dokumentiert und übersteuert.
- Service-Role-Handling ist aus Client-Pfaden entfernt; CI-/Workflow-Pfade laufen über explizite Guards.
- Patch 415 V3 bleibt als Vertragsanker relevant: workflow-/CI-nahe Edge-Pfade nutzen gemeinsamen Admin-/CI-Bearer-Guard.

## Operative Leitplanken

- Vor Workflow-/Template-Änderungen immer zuerst: `bash scripts/check_workflow_template_drift.sh`
- Für Workflow↔Edge-Verträge zusätzlich: `bash scripts/check_workflow_edge_contracts.sh`
- Branch-basierte CI-Lite-Chain bleibt eine **bewusste Ausnahme** und ist dokumentiert (kein stiller Default-Branch-Fallback in produktiven Deploy-Flows).

## Patch-Hinweis (ZIP-Workflow)

Bei Patch-ZIPs immer:
1. ZIP ins Projektroot legen
2. entpacken
3. ZIP direkt wieder löschen
4. Patch anwenden
5. `npm run typecheck`, `npm run lint:ci`, `npm run test:silent`
6. erst dann commit + push

> Historische Detailänderungen stehen bewusst in `docs/patches/PATCHLOG_ROOT.md` und den einzelnen `docs/patches/patch_*.md`-Notizen.
