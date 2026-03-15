# k1w1-a0style

## Schnellstart Doku

- Einstieg / Navigationsknoten: `docs/INDEX.md`
- Operatives Gesamtbild: `docs/00-overview.md`
- Offene Punkte (laufend): `docs/TODO.md`
- Patch-Ablauf: `docs/WORKFLOW_PATCHING.md`
- Patchlog (append-only): `docs/patches/PATCHLOG_ROOT.md`
- Kurz-Checklog (laufend): `PROJECT_CHECKLOG.md`

## Aktueller Stand (kompakt)

- Zuletzt abgeschlossen: **Patch 461**.
- Workflow-/CI-Lite-SoT ist nach 393A–417 konsolidiert; Drift-Guards und Invariants sind dafür etabliert.
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
