# SYSTEM_README

Stand: **2026-04-02 (Docs Konsolidierung)**

Dieses Dokument ist das **kompakte Systembild fuer Agenten**. Es ersetzt keine Patch-Historie und keine Detail-Runbooks.

## 1) System in kurz

- Expo / React Native App
- Supabase Edge Functions fuer auth-/scope-gebundene Serverpfade
- GitHub Actions / EAS fuer Build-Ausfuehrung
- Diagnostics-/Fix-Loops fuer Repo-/Build-Readiness
- Chat-/AI-Orchestrierung ueber `k1w1-handler`

## 2) Kanonische SoT

- **Repo/Branch:** `projectData.linked*`
- **Build-Gate / Diagnostics:** selection-scoped, fail-closed
- **Persistenz:** Projektzustand verschluesselt; Altstaende nur kontrolliert migriert
- **Edge-/Auth-Vertrag:** `docs/EDGE_FUNCTIONS_STATUS.md` + `docs/06-build-readiness.md`
- **Aktuelle Review / Restpunkte:** `docs/reviews/Review.md` + `docs/TODO.md`

## 3) Sicherheitslage (heutiger Stand)

- `k1w1-handler` nutzt verified JWT + Claim
- Workflow-/Build-/Artifact-Routen nutzen JWT + scoped secret
- Keystore-Routen nutzen JWT + dedizierten keystore-scoped secret
- Legacy-Functions `trigger-lint`, `check-lint`, `trigger-native-sync`, `check-native-sync`, `native-sync-report`, `native-sync-report-ingest`, `create_codesandbox` sind repo-seitig entfernt
- lokale Legacy-Compat-Oberflaeche wurde reduziert; verbleibende Legacy-Helfer dienen nur noch Migrations-/Import-Kompatibilitaet

## 4) Agent-Regeln

- keine stillen Fallbacks fuer Repo / Branch / Build-Profil reaktivieren
- keine alten Client-Provider-/Legacy-Key-Pfade fuer produktive KI-Requests wieder einfuehren
- keine Broad-Refactors ohne konkreten Befund
- nach Aenderungen mindestens:

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

Fuer den repo-internen Verify-/Docs-/Operator-Pfad zusaetzlich:

```bash
npm run typecheck:edge
npm run typecheck:strict
npm run docs:lint
npm run docs:check:contracts
npm run verify:release (inkl. App-Typecheck nur, wenn `node_modules/expo/tsconfig.base.json` vorhanden ist)
```

## 5) Nicht-Ziele dieses Dokuments

- keine Patchnummern-Langhistorie
- keine parallele TODO-Liste
- keine alte Systemarchitektur mit historischen Datei-Counts/Screen-Counts

Dafuer gelten:
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/INDEX.md`
