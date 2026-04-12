# k1w1-a0style

## Aktueller Repo-Stand

Stand: **2026-04-12 (Patch 774, SecurityDeepFixPass)**

Zuletzt abgeschlossen: **Patch 774**

Der aktuelle Stand bestaetigt:
- `tweetsodium` wurde fuer GitHub-Secret-Encryption durch `libsodium-wrappers-sumo` ersetzt (sealed-box Contract unveraendert, aktiver Maintainer-Stack)
- `signing_android` nutzt jetzt eine explizite deny-Policy nur fuer `anon, authenticated` statt grobem PUBLIC-Vertrag
- security-definer RPC-Haertung ist fuer `enforce_edge_rate_limit(...)` und `insert_diagnostic_upload(...)` via `search_path = public, pg_temp` reasserted
- App-Startup meldet fehlende Edge-URL sichtbar und hat einen robusten Timeout-Hinweis gegen unendlichen Initial-Spinner
- Preview-Secret-SoT ist auf den realen hash-only Vertrag synchronisiert (kein aktiver Raw-Fallback-Story-Drift in den Kern-Dokumenten)
- `check_docs_contracts.js` haertet den Preview-Secret-Vertrag semantisch (aktive Sektionen: `hash-only` Pflicht, Legacy-Raw-Fallback verboten)
- der verbliebene Preview-QR-UI-Rest ist entfernt; es gibt keinen irrefuehrenden QR-Action-Pfad mehr
- der bisherige type-only Zyklus zwischen `infra/github/workflows.ts` und `infra/github/workflowResponseParsers.ts` ist ueber `workflowTypes.ts` sauber entkoppelt
- die verbleibenden Residual-Hotspots (Chat, CI-Lite, EnhancedBuild, CredentialsWizard, GitHub Workflows) sind final geprueft; nur der direkte Scope wurde minimal gehaertet
- Chat/CI-Lite/EnhancedBuild/Workflow-Residuals wurden im direkten Scope weiter entmischt, ohne API-/Contract-Aenderung der Fassaden
- residuale A1/A2/A3-Hotspots wurden erneut im engen Scope geprueft; verbleibende Hauptdateien sind als schlanke Orchestratoren ohne erzwungenen Grossumbau belassen
- `useChatScreen` meldet `scrollToEnd`-Fehler im Retry-/Primary-Pfad jetzt sichtbar ueber `logger.warn(...)` statt stiller Catchs (keine Verhaltensaenderung am Flow)
- ein produktnaher Weak-Fallback (`AsyncStorage.getItem(...).catch(() => "")`) wurde in `GitHubReposScreen` auf expliziten Sentinel + Warn-Observability umgestellt
- Release-/Live-Truthfulness ist explizit: mit gesetzten `EDGE_BASE_URL` + frischem `EDGE_OPERATOR_JWT` (build_admin) ist `verify:release` fuer den Live-Teil `OK_FULL`; ohne Live-Env bleibt der ehrliche Status `OK_WITH_SKIPS`
- fuer den `k1w1-handler`-Live-Operatorfluss wird `EDGE_OPERATOR_JWT` als frischer `build_admin`-JWT benoetigt; `service_role` ist dabei nicht als gleichwertiger interaktiver User-Ersatz zu lesen
- die verbleibenden Hook-Hotspots wurden in einem sicheren Wave weiter entmischt (`useGitHubRepos`, `useCredentialsWizardScreen`, `useChatScreen`, `useEnhancedBuildScreen`) bei stabiler Public-API
- die fuehrende SoT-Doku wurde auf den neuen Hotspot-Abschluss synchronisiert (kein Analyse-only-/Refactor-Drift)
- der Workflow-Contract-Check wurde gegen Text-/Formulierungsdrift robuster gemacht, ohne Auth-/RBAC-Inhalt aufzuweichen
- produktive Runtime-Pfade sind erneut auf offensichtliche `console.log`-Reste geprueft (kein ungewollter Treffer ausser der zentralen Logger-Fassade)
- verbleibende Restpunkte sind transparent in `docs/TODO.md` gepflegt (inkl. externer Live-Themen)
- aktive Legacy-/Compat-Flaechen wurden stark reduziert
- die kanonischen Repo-Checks sind vorhanden und dokumentiert

Historische Details leben bewusst **nicht** mehr im README, sondern in:
- `docs/INDEX.md`
- `docs/reviews/Review.md`
- `docs/TODO.md`
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`

## Schnellstart

```bash
npm ci
npm run typecheck
npm run lint:ci
npm run test:silent
```

## Verifikation / Release

```bash
npm run verify:release (inkl. App-Typecheck nur, wenn `node_modules/expo/tsconfig.base.json` vorhanden ist)
```

Hinweis: `OK_WITH_SKIPS` bedeutet bewusst **kein** voller Release-Nachweis (nur partial/local evidence).

Optional mit read-only Live-Edge-Checks:

```bash
EDGE_BASE_URL="https://<project>.supabase.co/functions/v1" EDGE_OPERATOR_JWT="<extern provisionierter build_admin jwt>" npm run verify:release
```

## Kanonische Doku

- [Dokumentations-Index](docs/INDEX.md)
- [Overview / SoT](docs/00-overview.md)
- [Build Readiness](docs/06-build-readiness.md)
- [Testing Guide](docs/TESTING_GUIDE.md)
- [Fresh Checkout Green Path](docs/FRESH_CHECKOUT_GREEN_PATH.md)
- [Kanonische Review](docs/reviews/Review.md)
- [Kompakte TODO-/Restpunkt-SoT](docs/TODO.md)
- [App-Runbook](docs/runbooks/APP_RUNBOOK.md)
- [Patch Workflow](docs/WORKFLOW_PATCHING.md)

## Operative Leitplanken

- keine stillen Repo-/Branch-Fallbacks in produktiven Deploy-/Build-Pfaden
- Build-/Workflow-/Artifact-Routen bleiben fail-closed und explizit auth-/scope-gebunden
- `create_codesandbox` ist deaktiviert und **kein** aktiver Produktpfad mehr
- `docs/patches/*` bleibt append-only Historie, nicht aktive Produktdoku

## Hinweis zur Historie

Patch-Details, Langhistorie und alte Scan-Funde werden bewusst nicht mehr hier dupliziert. Dafuer gelten:
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/reviews/Review.md`
