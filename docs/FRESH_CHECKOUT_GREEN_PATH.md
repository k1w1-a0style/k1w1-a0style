# Fresh Checkout Green Path

Stand: **2026-04-12 (Patch 774, SecurityDeepFixPass)**

Dies ist der zentrale Verifikationspfad fuer einen frischen Checkout.

## Voraussetzungen

- Node.js `>=20.0.0`
- npm `>=10.0.0`
- frischer Checkout ohne lokale Altartefakte

## Green-Path Befehle

```bash
npm ci
npm run typecheck
npm run typecheck:edge
npm run lint:ci
npm run test:silent
```

Optional:

```bash
npm run test:e2e:smoke
npm run verify:release (inkl. App-Typecheck nur, wenn `node_modules/expo/tsconfig.base.json` vorhanden ist)
```

## Erwartete Signale

- alle Commands enden mit Exit-Code `0`
- keine TS-/ESLint-Fehler
- keine rote Jest-Suite
- `verify:release` ist nur dann `OK_FULL`, wenn zusaetzlich Live-Edge-Env gesetzt ist (`EDGE_BASE_URL` + `EDGE_OPERATOR_JWT`); ohne Live-Env ist der erwartete ehrliche Status `OK_WITH_SKIPS`

## Bekannter externer Warn-Noise

```txt
npm warn Unknown env config "http-proxy"
```

Das ist externer Umgebungs-Noise und kein Repo-Code-Defekt.
