# Fresh Checkout Green Path

Stand: **2026-03-31 (Patch 652)**

Diese Checkliste ist der zentrale Verifikationspfad fuer einen frischen Checkout.

## Voraussetzungen

- Node.js `>=20.0.0`
- npm `>=10.0.0`
- Repo frisch ausgecheckt, keine lokalen Altartefakte

Pruefen:

```bash
node --version
npm --version
```

## Green-Path Befehle

Im Repo-Root ausfuehren:

```bash
npm ci
npm run typecheck
npm run lint:ci
npm run test:silent
```

## Erwartete Signale

- `npm ci` laeuft ohne Fehler durch (`postinstall`/`prepare` koennen Hooks ausgeben).
- `npm run typecheck` endet ohne TypeScript-Fehler.
- `npm run lint:ci` endet ohne ESLint-Fehler.
- `npm run test:silent` endet mit gruener Suite.

## Bekannter externer Warn-Noise

- Die Warnung

```txt
npm warn Unknown env config "http-proxy"
```

  ist ein bekannter **externer Umgebungsrestpunkt** (Runner-/Host-Env) und kein Repo-Code-Defekt.
