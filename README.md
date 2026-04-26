# k1w1-a0style

## Aktueller Repo-Stand

Stand: **2026-04-24 (Patch 786, GradleWrapperShaAndroidTaskVerification)**
Zuletzt abgeschlossen: **Patch 786**

Kurzstatus:
- Repo-Checks und Docs-/Contract-Gates sind auf dem dokumentierten Stand gruen gelaufen.
- Zentrales Release-Gate ist `npm run release:ready`.
- Ohne gesetzte Live-ENV bleibt der ehrliche lokale Status erwartungsgemaess **GELB**; **GRUEN** mit Live-ENV.

## Schnellstart

```bash
npm ci
npm run typecheck
npm run lint:ci
npm run test:silent
```

## Verifikation / Release (zentral)

```bash
npm run release:ready
```

Ampel-Bedeutung von `release:ready`:
- `🟢 GRUEN`: alle Pflichtchecks bestanden
- `🟡 GELB`: Pflichtchecks bestanden, optionale Live-Checks wurden wegen fehlender ENV geskippt
- `🔴 ROT`: mindestens ein Pflichtcheck fehlgeschlagen

Live-Checks laufen nur mit gesetzter ENV (`EDGE_BASE_URL`, `EDGE_OPERATOR_JWT`):


Direkter Detaillauf (unterliegender Einzelcheck):

```bash
npm run verify:release
```

```bash
EDGE_BASE_URL="https://<project>.supabase.co/functions/v1" EDGE_OPERATOR_JWT="<extern provisionierter build_admin jwt>" npm run release:ready
```

Hinweis: `release:ready` ruft intern auch `verify:release` auf. Der App-Typecheck-Anteil in `verify:release` gilt nur, wenn `node_modules/expo/tsconfig.base.json` vorhanden ist.

## Doku-Navigation (aktive Einstiegspfade)

- [Dokumentations-Index](docs/INDEX.md)
- **Navigator:** [docs/INDEX.md](docs/INDEX.md)
- **Frischer Checkout (Green Path):** [docs/FRESH_CHECKOUT_GREEN_PATH.md](docs/FRESH_CHECKOUT_GREEN_PATH.md)
- **Tests & Verify-Gates:** [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md)
- **Aktuelle Review-SoT:** [docs/reviews/Review.md](docs/reviews/Review.md)
- **Release-Readiness-Befund:** [docs/reviews/RELEASE_READINESS_CODEX.md](docs/reviews/RELEASE_READINESS_CODEX.md)
- **Offene Punkte:** [docs/TODO.md](docs/TODO.md)
- **Edge-Vertragsstand:** [docs/EDGE_FUNCTIONS_STATUS.md](docs/EDGE_FUNCTIONS_STATUS.md)

## Historie (append-only)

- [PROJECT_CHECKLOG.md](PROJECT_CHECKLOG.md) — laufende Chronik, nicht operative Single-Source.
- [docs/patches/PATCHLOG_ROOT.md](docs/patches/PATCHLOG_ROOT.md) — Patch-Historie, append-only.
