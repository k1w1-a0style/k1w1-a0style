# Fresh Checkout Green Path

Stand: **2026-04-24 (Patch 786, GradleWrapperShaAndroidTaskVerification)**

Dieser Pfad ist bewusst **nur** fuer einen frischen lokalen Green-Run (ohne Historienballast).

## Voraussetzungen

- Node.js `>=20.0.0`
- npm `>=10.0.0`
- frischer Checkout ohne lokale Altartefakte

## Pflichtpfad (gruen im frischen Checkout)

```bash
npm ci
npm run typecheck
npm run typecheck:edge
npm run lint:ci
npm run test:silent
```

## Optionale Zusatzchecks

```bash
npm run test:e2e:smoke
npm run verify:release
```

## Erwartete Signale

- alle Commands enden mit Exit-Code `0`
- keine TS-/ESLint-Fehler
- keine rote Jest-Suite
- `verify:release` ist nur dann `OK_FULL`, wenn `EDGE_BASE_URL` + `EDGE_OPERATOR_JWT` gesetzt sind
- ohne Live-Env ist der erwartete ehrliche Status `OK_WITH_SKIPS`

## Bekannter externer Warn-Noise

```txt
npm warn Unknown env config "http-proxy"
```

Das ist externer Umgebungs-Noise und kein Repo-Code-Defekt.

## Verweise

- [Testing Guide](./TESTING_GUIDE.md)
- [Dokumentations-Index](./INDEX.md)
