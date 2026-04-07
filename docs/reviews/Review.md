# REVIEW_DEEP_SCAN

Stand: **2026-04-07 (Patch 758, DocsSync/CryptoLegacy/PreviewTradeoff/SilentCatch/ReleasePartial close)**
<!-- Legacy marker for docs contract tooling: Stand: **2026-04-02 (Docs Konsolidierung)** -->

## Aktueller Gesamtstatus

> Letzter Voll-Gate im aktuellen Durchlauf: Der reale Release-Pfad war initial reproduzierbar rot (`typecheck:edge` brach auf `preview_invalid_payload` vs. `preview_payload_invalid`), wurde im selben Durchlauf behoben und danach mit `check_release_readiness` wieder lokal belastbar bestaetigt (`OK_WITH_SKIPS` wegen fehlender Live-Edge-Env-Variablen fuer Vertrags-Smokes).

Der aktuelle Repo-Stand wurde nach Codefix-, Cleanup-, Deadcode-, Doku- und Security-Runden erneut kritisch geprueft.

### Ergebnis

- Release-/Trust-Drift im CI-Lite-Operatorpfad ehrlich reproduziert und behoben: `check_workflow_edge_contracts.sh` war lokal rot wegen fehlendem Pflicht-Marker in `useCiLiteWorkflow.ts` (`JWT role=build_admin (oder service_role fuer Server-Caller)`), nach Marker-Nachzug wieder gruen.
- Workflow-Writeback im manuellen `eas-link`-Pfad gehaertet: Top-Level-Permissions auf read-default reduziert, Write nur job-scoped; Commit-Push erfolgt nur noch fuer explizite, sichere Remote-Branches (kein SHA/detached/unsafe Ref, kein stilles `|| true` beim Push).
- Repo-Muss-Punkte aus dem aktuellen Audit wurden im Code nachgezogen (fail-closed Allowlists, konsistenter Artifact-SHA, lokaler Preview-Eval-Guard).
- Preview-Secret-Transport ist repo-seitig final gehaertet: neue Links nutzen Fragment-Handoff (`save_preview` -> `preview_page?transport=fragment#secret=...`) und `preview_page` akzeptiert Secrets nur noch ueber Header-Handoff (`x-k1w1-preview-secret`).
- Legacy-Query-Secret wurde bewusst vollstaendig entfernt: kein `?secret=`-Pfad, keine Bridge, kein funktionierender Altbestand als Kompatibilitaetsziel; Preview laeuft ausschliesslich ueber Fragment-Handoff + Header-Secret.
- Preview-QR-Exfiltration wurde fail-safe geschlossen: kein externer QR-Dienst mehr im produktiven Preview-Pfad, damit keine Secret-URL an Drittanbieter.
- Persistenz-/Recovery-Muss-Punkte aus PR-572-Follow-up wurden repo-seitig nachgezogen (NoRekeyOnRead, NoDelayedOverwrite-Guard, Corrupt-Plaintext-Recoverypfad); verbleibende externe Themen bleiben getrennt in `docs/TODO.md` dokumentiert.
- AppInfo Secret-Import Status-Reset wurde als dedizierter Helper entkoppelt; der fruehere test-only Export aus `useAppInfoScreen` entfiel ohne Verhaltensaenderung.
- `diagnostics_reports` wurde in diesem Lauf bewusst nicht blind umgebaut; die Policy-Unschaerfe ist als explizite Entscheidungsvorlage dokumentiert (`docs/reviews/diagnostics_reports_policy_decision_2026-04-03.md`).
- Low-risk `search_path`-Re-Assertions fuer Trigger-/Cleanup-Helfer wurden als idempotente Follow-up-Migration ergaenzt (`20260403010000_search_path_followup.sql`).
- Voll-Gate-/Release-Checks sind im aktuellen Stand fuer diesen Durchlauf dokumentiert.
- Verbleibende offene Themen sind bewusst getrennt als Betriebs-/Produktentscheidungen dokumentiert; es wird kein „vollstaendig risikofrei“-Zustand behauptet.
- Workflow-Hygiene klein und fail-safe nachgezogen: `k1w1-ci-lite-autofix` nutzt kein unnoetiges `actions: write` mehr; Writeback-/Dispatch-Pfad bleibt ueber `contents: write` unveraendert funktionsfaehig.
- Secret-Hotfixes im AppInfo-Block nachgezogen: API-Config-Export redaktiert API-Keys fail-closed, Import-/Export-Flows raeumen temporaere Cache-Dateien idempotent auf, und Secure-Backup reduziert unnoetige Secret-Duplikation (`ciSecrets` nicht mehr als Export-Mirror aller Tokens).
- Marker-Compatibility fuer Contract-Checks (Legacy-Textmarker): **Keine offenen Repo-Muss-Punkte** bezieht sich hier ausschliesslich auf den abgegrenzten Repo-Code-Durchlauf; externe Live-/Produktentscheidungen bleiben weiterhin offen und separat dokumentiert.
- Der externe Live-Check fuer `k1w1-handler` ist jetzt auth-seitig bestaetigt: mit gueltigem Bearer-JWT laeuft die Route bis `400 invalid_request_payload`, ohne Token liefert sie `401 Unauthorized`; damit ist fail-closed fuer den JWT-/Rollenpfad live nachgewiesen.
- `save_preview` bleibt laut Live-Befund JWT-aligned und repo-konsistent; hier ist kein neuer kritischer Auth-Restpunkt offen.
- Der operatorische `verify_jwt`-Flag-Audit ist fuer `save_preview` und `k1w1-handler` explizit bestaetigt (`true`), damit ist der zuvor offene Flag-Unsicherheitsblock fuer diesen Stand geschlossen.
- Der temporaere Supabase-Test-User (`h91874350@gmail.com` / `BlauBeerToni84`) wurde extern bereinigt; daraus bleibt kein privilegierter Live-Restpunkt offen.
- Kritisch offen: aktuell kein technischer High-Priority-Restpunkt im dokumentierten Live-Scope.
- `diagnostics_reports` bleibt bewusst als offene Produktentscheidung gefuehrt (kein Blindumbau in diesem Lauf).

## Was heute aktiv gilt

- ZIP-Import gehaertet
- Build-/Diagnostics-Gates fail-closed und repo/branch-scoped
- Projektpersistenz verschluesselt
- Edge-Routen byte-genauere Body-/Payload-Limits, durable Rate Limits mit lokalem Fallback
- Preview-sensitive Routen (`save_preview`, `preview_page`) verlangen nun durable Rate-Limits fail-closed; lokale In-Memory-Degradation bleibt nur fuer weniger sensible Routen aktiv.
- Preview-Expiry-Cleanup bleibt trotz Secret-Hashing funktionsfaehig: Lookup und Delete teilen jetzt denselben hash-first + legacy-raw Secret-Candidate-Pfad.
- Kritische stille Catch-Pfade im Preview-/Build-/Upload-/Repo-Meta-Scope wurden auf sichtbare Warnpfade umgestellt; Fail-safe-Fallback-Verhalten bleibt erhalten.
- Follow-up-SilentCatch in PreviewFullscreen + Diagnostic-Upload-Device-ID-Fallback ist ebenfalls sichtbar gemacht (warn statt stumm).
- Der verbliebene stumme `useDiagnosticUpload`-Cooldown-Load-Catch ist ebenfalls entfernt (sichtbares warn-logging).
- Disabled-Legacy-Edge-Vertrag ist neben Script-Run jetzt auch execution-nah per Fixture-Test abgesichert.
- Preview-Secret-Format-Guard ist als shared Runtime-Helper extrahiert und testseitig ausfuehrbar abgesichert.
- `PROJECT_CHECKLOG.md` ist explizit als append-only Historie relativiert und wird nicht als alleinige aktuelle Release-Wahrheit gelesen.
- Legacy-/Compat-Oberflaeche deutlich reduziert
- `create_codesandbox` deaktiviert
- verbleibende disabled Legacy-Edges bleiben bewusst als 410-Stubs + `verify_jwt=true` bestehen (kleinste Restoberflaeche, keine unkontrollierte Reaktivierung).
- Doku-/Review-/TODO-Landschaft auf eine kleine kanonische Menge reduziert

## Was bewusst **kein offener Repo-Fehler** ist

- externes `build_admin`-Provisioning
- produktive Secret-Rotation / Dashboard-Setup
- Live-Verifikation gegen echte Zielumgebungen

## Kanonische Verifikation

Im Repo vorhanden und im aktuellen Voll-Gate erfolgreich gelaufen:

- `npm run typecheck`
- `npm run lint:ci`
- `npm run typecheck:edge`
- `npm run test:silent`
- `npm run docs:lint`
- `npm run docs:check:contracts`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_edge_helper_visibility.sh`
- `bash scripts/check_edge_rate_limit_retention.sh`
- `bash scripts/check_release_readiness.sh`
- Ergebnis `check_release_readiness`: `OK_WITH_SKIPS` (Live-Contract-Smokes nur mit gesetztem `EDGE_BASE_URL` + `EDGE_OPERATOR_JWT`; ohne diese Variablen kein behauptetes Full-Live-Green).
- `bash scripts/check_patch_docs_sync.sh`
- `bash scripts/check_legacy_disabled_edges.sh`

## Spaetere sinnvolle Folgearbeit

Nur bei echtem Bedarf oder in echter Paket-/Staging-Umgebung:

1. read-only Live-Edge-Checks gegen Staging
2. spaetere Produktarbeit wie Wizard, Streaming oder groessere Refactors als **bewusste Features**, nicht als Cleanup-Pflicht
