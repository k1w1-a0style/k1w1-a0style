# Patch 315: ESLint no-console baseline warning

## Ziel

Den nächsten offenen Punkt aus der Fix-/TODO-Liste umsetzen: `no-console` als sichtbare Lint-Regel aktivieren, zunächst nicht-blockierend.

## Änderung

- In `eslint.config.js` wurde die Regel aktiviert:
  - `no-console: ['warn', { allow: ['warn', 'error'] }]`
- Dadurch werden neue `console.log/info/debug`-Stellen im Lint sichtbar.
- `console.warn` und `console.error` bleiben erlaubt.

## Warum so?

- Das ist ein sicherer Zwischenschritt für die laufende Logger-Migration.
- In diesem Repo läuft CI-Lint mit `--quiet`; Warnungen bleiben damit non-blocking, bis wir auf `error` hochziehen.

## Checks

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
