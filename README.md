# k1w1-a0style

## Aktueller Repo-Stand

Stand: **2026-04-07 (Patch 752, Preview-Expiry-Cleanup Hash/Legacy Fix)**

Zuletzt abgeschlossen: **Patch 752**

Der aktuelle Stand bestaetigt:
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
