# Patchlog Root

Append-only Überblick über Patch-Notizen.

## Recent (kompakt)
- Patch 459: Rest-Regression aus PR #272 geschlossen — Attachment-Hinweis wird nicht mehr vor Meta-Command-Routing in den User-Input injiziert; lokale/full-line Kommandos (`cat ...`, `zeige datei ...`) laufen wieder auf unverändertem Raw-Input, während der Hinweis nur im normalen AI-Request-Payload landet; gezielte Invariant-Regression ergänzt.
- Patch 458: ChatScreen/Chat-Flow konservativ gehärtet — Attachment-Kommunikation ist jetzt explizit ehrlich (Dateiname/Metadaten statt impliziter Inhaltsanalyse), Chat-History wird bereits beim Append per Retention begrenzt, Focus-Cleanup räumt Pending-/Modal-/Streaming-State auf, und chatAIFlow-Typing-/Import-Artefakte wurden bereinigt.
- Patch 457: Offener Connections-Busy-Guard-UX-Bug geschlossen — dedizierter `BusyGuardActiveError` trennt Busy-Kollisionen von echten Save/Test-Fehlern, sodass der Hinweis „Ein anderer Save/Test-Lauf ist noch aktiv.“ nur noch bei realer Konkurrenz erscheint; `useChatAIFlow`-Pending-Plan-Guard wurde gezielt geprüft und per Invariant gegen versehentlichen Logikdrift abgesichert.
- Patch 456: Chat-Drift-Digest gegen RN-Runtime-Regression abgesichert — `lib/chatFlowStateGuards.ts` dokumentiert nun explizit Node-`crypto`-Importverbot im App-Pfad (`useChatAIFlow`), Hashing bleibt runtime-safe ohne Metro-Polyfill-Abhängigkeit.
- Patch 455: ConnectionsScreen konservativ gehärtet — Supabase-ANON-Key von AsyncStorage auf SecureStore mit Legacy-Migration umgestellt, Busy-/Hydration-Guards gegen parallele Save/Test-Runs ergänzt, `testExpo`-Persistenz-Side-Effect entfernt, Connection-Light-Writes teilweise gebündelt und EAS-Link-Lampe nicht mehr optimistisch auf grün gesetzt; inklusive gezielter Flow-/Storage-Regressionstests.
- Patch 454: flakigen Timeout-Restpunkt in `__tests__/oneClickDeploy.test.tsx` konservativ stabilisiert — deterministischer Press-Start via `act` + Microtask-Flush, AsyncStorage-Default-Resolves pro Test und striktes Cleanup (`cleanup` + Timer-Clear) gegen runInBand-Rennen; kein Produktcode-Umbau.
- Patch 453: KI-/Chat-Nachaudit (misstrauisch): echte Restlücke im Builder-NonJSON-Pfad geschlossen (`output_text` → nutzerlesbare Fehler-Preview), Regressionstests für `normalizer` gezielt verschärft.
- Patch 452: KI-/Chat-/Prompting-Block konservativ gehärtet; projektrelevante Snapshot-Priorisierung im Prompt-Context, verständlicher Builder-NonJSON-Fehlerpfad mit KI-Text-Preview, SHA-256 State-Drift-Digest (statt Länge), transparentere Ownership-/Validator-/Explain-Hinweise im Chat-Feedback; keine neue KI-Architektur, `k1w1-handler` nur eingeordnet.
- Patch 451: Preview-Restpunkte konservativ geschlossen — `filesFingerprint` erkennt nun auch Same-Length-Content-Änderungen (content-hash-basiert), Crash-Recovery (`onContentProcessDidTerminate`/`onRenderProcessGone`) ist auch im normalen PreviewScreen verdrahtet, abgelaufene Supabase-URLs werden im PreviewScreen nicht mehr blind geladen, und flow-nahe Helper-/Typing-/Dependency-Duplikate im Preview-Block wurden ohne Broad-Refactor konsolidiert.
- Patch 450: CustomHeader-/CI-Lite-Restfix konservativ geschlossen — `useGitHubActionsLogs` resetet stale Run/Log-State bei Input-Wechsel und schützt vor verspäteten Responses; CI-Lite-Persistenz schreibt nur für den aktiven CI-Lite-Run-Kontext (kein Autofix-Fehlpersist), Dispatch-Guard verhindert Doppeltap-Doppelstart, plus flow-nahe Typing-/Artifact-/Patch-Sync-Härtung ohne Broad-Refactor.
- Patch 449: EnhancedBuildScreen-Restpunkte konservativ nachgezogen — OneClickDeploy-Vorab-Push entfernt (SHA-sichere Reihenfolge über `startBuildJob`), redundanter Doppel-Push eliminiert, `canStartBuildUi` gegen Ref-Drift stabilisiert und build-/logs-nahe `WorkflowRun`-Typing inkl. `event`-Feld vereinheitlicht.
- Patch 448: DiagnosticScreen-Restpunkte konservativ geschlossen — progressive Preflight-Severity wieder sichtbar (`stage` korrekt), KI-Fix-Hinweis für `pass`-Items entfernt und flow-nahe Typing-/Hook-Cleanups in Runner/Screen-Hook ergänzt; gezielte Regressionen für Stage-Text und Fix-Hinweis hinzugefügt.
- Patch 447: kleiner Edge-/Deno-Typing-Follow-up in `_shared` — `globalThis as any` in Auth/CORS durch getypte Runtime-Globals ersetzt, `validation`-Any-Hotspots für Trigger/Workflow-Dispatch auf enge Union-/Record-Typen umgestellt und `parseJsonBody` gegen nicht-Objekt-JSON regressionsgesichert.
- Patch 446: selektiver Type-Safety-Restpunkt im Build-Start-Flow geschlossen — `buildStartService` ersetzt riskante `as any`-Zugriffe auf Edge-Invoke-Payload durch lokales Narrowing, entfernt unnötigen Push-Cast und ergänzt gezielte Regressionen für `job.id`-/Error-Payload-Shape.
- Patch 445: `save_preview`-Konsistenz zusätzlich gegen Auth-/Rate-Limit-Fehlerpfade abgesichert und kleiner Deno/Node-Typecheck-Restpunkt in `_shared/auth` per runtime-kompatiblem Env-Lookup behoben; Typecheck wieder grün.
- Patch 444: `save_preview` CORS-/Response-Konsistenz konservativ gehärtet — lokaler Erfolgs-/Fehlerpfad nutzt jetzt denselben `_shared/cors`-Header-Stack wie Auth/Rate-Limit-Guards; gezielte Invariants sichern Header-Gleichlauf inkl. Security-Headern.
- Patch 443: k1w1-handler Provider-Randfälle gehärtet — Anthropic sendet bei reinen `system`-Prompts kein leeres `messages`-Array mehr (konservativer Fallback-Turn), Gemini behandelt `system` explizit via `systemInstruction` + nicht-leerer `contents`-Fallback; doppeltes Nullish-Coalescing bereinigt, Invariants ergänzt.
- Patch 442: Build-Status/Phasenanzeige im EnhancedBuildScreen gezielt beruhigt — aktiver Lauf vs. letzter bekannter Stand klarer getrennt, aktive Phase explizit markiert, Run/Artifact/Download-Aktionen als aktueller vs. letzter Build-Kontext verständlicher benannt (ohne Backend-/Flow-Umbau).
- Patch 441: gezieltes UX-Feintuning nur für BuildScreen/DiagnosisScreen/Preview — verständlichere CTA-/Aktionssprache, ruhigere und konsistentere Statusbegriffe (inkl. Live/Fallback/Preview-Fehler), ohne Architekturumbau
- Patch 440: konservatives UX-/Flow-Feintuning in Kernpfaden (Build/Diagnosis/Preview/Connections/Credentials/Chat-Menü) — missverständliche/zu technische Status- und Hinweistexte geschärft, gespeicherter vs. letzter bekannter Zustand klarer getrennt, gezielte Preview-Status-Regression ergänzt
- Patch 439: zusätzliche Invariant-Härtung für `insert_diagnostic_upload`-Historie; UUID-Drift bleibt auf zwei bekannte Altmigrationen begrenzt und Legacy-Spalten-Drift (`repo/branch/mode/platform/report/meta`) wird im finalen Vertrag regressionssicher geblockt
- Patch 438: Supabase-Edge Import-Hygiene — produktive Workflow-Edges von fragilem App-Pfadimport (`../../../shared/constants/github.ts`) entkoppelt; `GITHUB_API_BASE` edge-nah in `_shared/github.ts` verankert, Invariant-Guard ergänzt.
- Patch 437: Doppelte Preview-Migration (`20251226140000`/`20251226160000`) als byte-identische Redundanz eingeordnet; spätere Datei konservativ auf explizites Legacy-No-op umgestellt (keine riskante History-Löschung).
- Patch 436: `insert_diagnostic_upload`-Vertrag migrationsseitig finalisiert (`jsonb -> bigint`), historischen UUID-/Spalten-Drift explizit dokumentiert und per Invariant-Tests gegen Regression abgesichert
- Patch 435: Supabase E2E contract close-out — audited Preview/Workflow/Signing/AI edge contracts end-to-end, documented explicit remaining operator dependencies, and fixed `github-run-artifact-json` ZIP path normalization for backslash-separated entries.
- Patch 434: Abschluss des großen Supabase-E2E-Contract-Audits; zentrale Edge-Function-SoT um produktive Signing/Preview/AI-Endpunkte ergänzt und Credentials-Wizard auf Constants statt Hardcodes umgestellt (inkl. Invariant-Tests).
- Patch 433: Supabase-Edge E2E-Contract-Audit; Credentials-Wizard Edge-200/Error-Mapping zentral gehärtet und per Jest-Regressionstest abgesichert.
- Patch 432: Ownership-/Permission-Audit; zentrale Guard-Matrix für Template/Baseline, Chat-Writeback und Diagnosis/Autofix eingeführt, inklusive konservativer Konfliktbehandlung und Regressionstests.
- Patch 431: System-Audit-Fix — Diagnostic-Status auf Repo/Branch scoped gemacht (mit Legacy-Fallback), damit Diagnosis→Build-Readiness keine Cross-Repo/Cross-Branch-Freigabe mehr erzeugt.
- Patch 430: Live-Reachability-Audit für 5 KI-Provider mit realen Smoke-Requests; in dieser Umgebung alle Checks als missing_secret klassifiziert; k1w1-Handler-HTTP-Fehler enthalten jetzt konsistent provider+model-Kontext, Groq-Fallback liefert resolved model zurück
- Patch 429: KI-Provider-/Modell-Audit; k1w1-Edge-Defaults auf aktuelle app-konsistente Modelle gehärtet, Groq-Prefix-Fallback ergänzt, Invariants erweitert
- Patch 428: Zweiter Korrektheits-Check; flakiges One-Click-Deploy-Timeout im Test stabilisiert (kein Produktionscode-Drift)
- Patch 427: Supabase-Function-Flow-Audit; Credentials-Wizard meldet Edge-HTTP-/Timeout-Fehler jetzt vertragstreu statt generisch
- Patch 426: Chat/KI-Confirm→Apply-Pfad gegen Zustandsdrift gehärtet (Rebase auf latest project state + transparente Drift-Meldung + Guard-Regressionstests)
- Patch 425: One-Click-Deploy um hartes Readiness-Gate (Diagnostik + CI-Lite + Repo/Branch-Frische) erweitert; mode-abhängige Pipeline-Filterlogik testbar extrahiert
- Patch 424: Supabase-Preview als offiziellen Browser-/QR-Preview-Weg im Produkt klarer markiert (URL-/Expiry-/Fallback-Transparenz, QR-Aktion ohne Architekturumbau)
- Patch 423: konservatives Machbarkeits-Audit für Expo Web / QR-Web-Preview (ohne Umbau); Empfehlung B mit minimalen Vorarbeiten
- Patch 422: job-gebundene History-Selektion für Repo/Branch/Profil im Build-Polling gehärtet (E2E-Traceability gegen Drift zwischen UI-Zustand und gestarteter Build-Wahrheit)
- Patch 421: Build-Traceability für gestartete Jobs gehärtet (Repo/Branch/Profil konsistent in CurrentBuild/History/UI sichtbar, inkl. CSV-/Status-Transparenz)
- Patch 420: managed-workflow guardrails gegen implizite ref/default-branch Fallbacks gehärtet; CI/CI-Lite-Ausnahme explizit als Vertrag abgesichert
- Patch 419: follow-up auf PR #206; `EDGE_FUNCTIONS_STATUS`-Indexlink in `docs/INDEX.md` wiederhergestellt und Patch-Benennung konsistent gehalten
- Patch 418 V1: trust/docs consolidation sweep; core architecture docs auf Post-417-Stand gezogen, offene Follow-ups zentral in TODO gesammelt, MD-/Notes-Cleanup als nächster Schritt verankert
- Patch 417 V18: V17-Verträge beibehalten, versehentlich committetes Repo-Root-Patch-Artefakt entfernt, Patch-Bundles/-Dateien gegen Re-Commit ignoriert
- Patch 416: retired lint/native-sync edge functions in `supabase/config.toml` deaktiviert, 410-legacy stubs explizit belassen, Guard-/Invariant-Coverage ergänzt
- Patch 415 V3: workflow-/CI-edge paths auf gemeinsamen admin-or-CI-bearer guard ausgerichtet; wizard/keystore setup admin-only belassen
- Patch 414 V13: explizite Ref-SoT-Invariants für Workflow-Templates gehärtet; dokumentierte branch-basierte CI-Lite-Ausnahme bewusst erhalten
- Patch 413: restliche stille repo/config + branch/main fallbacks entfernt; Repo/Branch-SoT-Regression-Coverage ergänzt
- Patch 412: `_diagnostic_upload_guard()` mit explizitem `search_path`; versehentliche `PUBLIC` execute-Rechte entzogen; Guard-/Invariant-Coverage ergänzt
- Patch 411: Supabase deploy workflow auf `workflow_dispatch` + required `ref` gehärtet; single-function/_shared guards + migrations policy + metadata synchronisiert
- Patch 410 / 410B: Edge admin auth vom service-role lookup getrennt, CI bearer guard ergänzt, service-role handling aus Client-Pfaden entfernt
- Patch 409 / 408: diagnostics upload ids als opaque strings im Client stabilisiert; build job id contract auf positive numerische IDs ausgerichtet
- Patch 407–403: Repo/Branch-SoT-Härtung, Workflow-Governance, Contract-/Drift-Guards und Doku-Sync konsolidiert
- Patch 401–389: Provider-/Helper-Invariants, CI-Lite-SHA-/Template-Drift-Härtung, Dispatch-/Trigger-Polish

## Historical (selected)
- Patch 388: workflow drift validator + stronger patch artifact discipline
- Patch 387: managed workflow drift hardening + CI-lite template SHA metadata + cleanup
- Patch 386: SHA hardening phase 2 + workflow marker completion + patch artifact discipline
- Patch 385: Project-context SoT correction + CI Lite artifact/autofix hardening
- Patch 383: Workflow hardening for explicit ref handling + manual-path transparency
- Patch 382: Build screen CI Lite gating + stale transparency
- Patch 381: CI Lite SoT hardening + build gate metadata persistence
- Patch 380: CI Lite dispatch robustness (ref input + auto-bootstrap on 422)
- Patch 379: Guard against flattened workflow YAML/templates + invariant test to catch newline loss
- Patch 374: CI-Lite workflows produce deterministic result JSON artifact + checkout input ref
- Patch 373: Metro blockList CI-lite env overlay + remove private metro-config import
- Patch 372: Expo/Metro ignores CI-Lite env overlay files (fix dev bundler parse error)
- Patch 371: CI-Lite workflow templates pin ESLint@8 fallback for legacy configs
- Patch 370: Patchlog restore patch_337 dual references (invariant I10)
- Patch 369: CI-Lite in-app status uses GitHub truth (fix green/rot mismatch)
- Patch 368: CI-Lite smoke diagnostics + gitignore

## Legacy patch-337 references
- docs/patches/patch_337.md
- docs/patches/PATCH_337_NOTES.md

