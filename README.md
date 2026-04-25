# k1w1-a0style

## Aktueller Repo-Stand

Stand: **2026-04-24 (Patch 786, GradleWrapperShaAndroidTaskVerification)**
Zuletzt abgeschlossen: **Patch 786**

Kurzstatus:
- Repo-Checks und Docs-/Contract-Gates sind auf dem dokumentierten Stand gruen gelaufen.
- `verify:release` ist lokal ohne Live-Env erwartungsgemaess `OK_WITH_SKIPS`; `OK_FULL` gilt nur mit gesetzten Live-Variablen.
- Detailhistorie bleibt bewusst in Checklog/Patchlog (append-only), nicht im README.

## Schnellstart

```bash
npm ci
npm run typecheck
npm run lint:ci
npm run test:silent
```

## Verifikation / Release

```bash
npm run verify:release
```

Optional mit read-only Live-Checks:

```bash
EDGE_BASE_URL="https://<project>.supabase.co/functions/v1" EDGE_OPERATOR_JWT="<extern provisionierter build_admin jwt>" npm run verify:release
```

## Doku-Navigation (aktive Einstiegspfade)

- [Dokumentations-Index](docs/INDEX.md)
- **Navigator:** [docs/INDEX.md](docs/INDEX.md)
- **Frischer Checkout (Green Path):** [docs/FRESH_CHECKOUT_GREEN_PATH.md](docs/FRESH_CHECKOUT_GREEN_PATH.md)
- **Tests & Verify-Gates:** [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md)
- **Aktuelle Review-SoT:** [docs/reviews/Review.md](docs/reviews/Review.md)
- **Offene Punkte:** [docs/TODO.md](docs/TODO.md)
- **Edge-Vertragsstand:** [docs/EDGE_FUNCTIONS_STATUS.md](docs/EDGE_FUNCTIONS_STATUS.md)

## Historie (append-only)

- [PROJECT_CHECKLOG.md](PROJECT_CHECKLOG.md) — laufende Chronik, nicht operative Single-Source.
- [docs/patches/PATCHLOG_ROOT.md](docs/patches/PATCHLOG_ROOT.md) — Patch-Historie, append-only.

Hinweis: App-Typecheck-Anteil in `npm run verify:release` nur, wenn `node_modules/expo/tsconfig.base.json` vorhanden ist.
