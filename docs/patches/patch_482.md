# Patch 482 — Schritt 6: verifizierte Restpunkte eng nachgezogen

## Kontext

Schritt 6 sollte ausschließlich die Punkte **E3, E8, E9, N7, S7** erneut gegen den aktuellen Stand prüfen — ohne Broad Refactor, ohne künstliche Reaktivierung alter Alt-Funde.

## Bewertung

- **E8:** im aktuellen Stand bereits erledigt. `startBuildJob(...)` und `assertBuildReadiness(...)` verlangen einen expliziten `linkedBranch`; der frühere `main`-/Default-Branch-Fallback ist im produktiven Pfad nicht mehr vorhanden.
- **E9:** im aktuellen Stand bereits erledigt. `ProjectContext.startBuild(...)` delegiert den Build-Start weiterhin an `startBuildJob(...)`; kein alternativer Build-Bypass wurde neu eingeführt.
- **N7 / S7:** im aktuellen Repo-Stand kein belastbarer aktueller Fund nachweisbar; daher bewusst nicht künstlich wieder geöffnet.
- **E3:** funktional weitgehend erledigt, aber ein kleiner UX-Rest blieb: Wenn GitHub beim Token-Check keinen `x-oauth-scopes`-Header liefert, zeigte die Connections-Karte bisher einen irreführenden Badge `unknown (nicht frisch geprüft)`, obwohl der Check frisch gelaufen war.

## Umsetzung

- `StatusCard` rendert den Scopes-Bereich jetzt nur noch, wenn wirklich ein Scopes-Header vorhanden ist.
- Fehlt der Header, bleibt die Karte ruhig/neutral statt einen irreführenden Unknown-Badge zu zeigen.
- Ergänzte Regression prüft genau dieses Verhalten plus den regulären Header-Fall.

## Verifikation

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `npm run test:silent -- --runInBand __tests__/connectionsScreen.githubScopesDisplay.test.ts __tests__/buildReadinessGate.branchMissing.test.ts __tests__/projectContext.sotResolvers.test.ts`
