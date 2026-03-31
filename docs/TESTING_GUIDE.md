# Testing Guide

Stand: **2026-03-31 (Patch 651)**

## Zweck

Diese Datei beschreibt den **aktuellen** lokalen Testpfad. Historische Preview-spezifische Schrittlisten wurden entfernt, weil sie veraltete Umgebungspfade und alte Suite-Zahlen enthielten.

## Kanonischer Ablauf (lokal)

1. Abhaengigkeiten sauber installieren.
2. Typecheck, Lint und Tests in genau dieser Reihenfolge laufen lassen.

```bash
npm ci
npm run typecheck
npm run lint:ci
npm run test:silent
```

## Voraussetzungen

- Node.js `>=20.0.0`
- npm `>=10.0.0`

```bash
node --version
npm --version
```

## Erwartete Ergebnisse

- Jeder Command endet mit Exit-Code `0`.
- Keine TypeScript-Fehler.
- Keine ESLint-Fehler.
- Jest-Suite komplett gruen.

## Bekannte externe Warnung

In manchen Umgebungen kann waehrend `npm`-Aufrufen folgende Warnung erscheinen:

```txt
npm warn Unknown env config "http-proxy"
```

Das ist externer Umgebungs-Noise (Runner/Host) und kein Repo-Code-Defekt.

## Verweis

- Fuer den reproduzierbaren Fresh-Checkout-Verifikationspfad siehe: `docs/FRESH_CHECKOUT_GREEN_PATH.md`.
