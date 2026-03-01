# Patch 330: Expo GraphQL Parse-Hardening + weitere TS-Hygiene

## Ziel
Regression fixen: malformed/HTML Expo-GraphQL-Antworten durften nicht mehr als Erfolg gelten.
Zusätzlich weitere kleine TS-Hygiene-Punkte aus der offenen Fix-Liste bündeln.

## Änderungen

### 1) Expo-Test robust gegen malformed Payloads
- Neue Utility `screens/ConnectionsScreen/utils/expoGraphql.ts`.
- `parseExpoGraphQLUsername(raw)` behandelt strikt:
  - ungültiges JSON => Fehler
  - Nicht-Objekt/fehlende `data` => Fehler
  - GraphQL-`errors` => Fehler
- `useConnectionsScreen.testExpo` nutzt den Parser und setzt `CONN_EXPO_OK=true` nur bei validen Nutzerdaten.

### 2) Regressionstest ergänzt
- Neuer Test `__tests__/connectionsScreen.expoGraphql.test.ts`.
- Deckt ab:
  - valides Payload => Username
  - HTML/malformed body => Fehler
  - `{}` ohne Daten => Fehler
  - GraphQL errors => Fehler

### 3) Weitere TS-Hygiene in `useGitHubRepos`
- Mehrere `catch (e: any)` auf `unknown` umgestellt.
- Gemeinsamer Error-Message-Helper (`getErrorMessage`) statt untypisiertem Zugriff.
- Tree-Entry-Zugriffe in `pullFromRepo` mit `RepoTreeEntry` typisiert (inkl. Pfad-Guard).

## Validierung

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
