# Patch 520: Edge-Admin-Key-Diagnose lokal ehrlich klassifiziert

## Kontext / Problem

Der lokale Edge Admin Key lebt in der App im SecureStore und wird fuer geschuetzte Edge-Requests aus Wizard, Preview und CI Lite verwendet. In der Praxis gab es aber einen unehrlichen Diagnosepfad:

1. Ein lokaler Key war bereits vorhanden und formal gueltig.
2. Der Edge-Server antwortete trotzdem mit `401`, `403` oder Texten wie `missing or invalid admin key`.
3. Teile der UI klassifizierten diesen Fall trotzdem als `missing`, obwohl lokal gar nichts fehlte.

Dadurch wirkten gefuelltes Feld, Preview-Fehler und Build-/CI-Hinweise widerspruechlich. Nutzer konnten nicht sauber unterscheiden zwischen „kein lokaler Key gespeichert“ und „lokaler Key vorhanden, aber serverseitig abgelehnt“.

## Umsetzung

- `screens/CredentialsWizardScreen/utils/localAdminKey.ts`
  - trennt die Klassifizierung jetzt strikt in `missing`, `invalid`, `rejected`, `unknown`,
  - nutzt `missing` nur noch fuer wirklich leere lokale Werte,
  - behandelt 401/403, `missing or invalid admin`, `invalid admin`, `x-k1w1-admin-key`, `authorization` und aehnliche Auth-Hinweise bei vorhandenem lokalem Key konsequent als `rejected`,
  - formuliert den Nutzertext ehrlicher: der lokale Key war vorhanden und wurde fuer einen geschuetzten Request verwendet, wurde aber serverseitig abgelehnt.
- `hooks/previewHelpers.ts` + `hooks/usePreview.ts`
  - verwenden denselben Diagnosegrund jetzt auch fuer Remote-Preview-Fails,
  - unterscheiden vor dem Remote-Call bereits zwischen lokal fehlendem und formal ungueltigem Key,
  - lassen den lokalen HTML-Fallback weiter zu, aber mit ehrlicherem Remote-Blockertext.
- `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`
  - nutzt dieselbe Klassifizierung fuer CI-Lite-Dispatch und Artifact-Abruf,
  - blockiert bei lokal fehlendem/ungueltigem Key schon vor dem Request klar,
  - meldet serverseitige Ablehnung nicht mehr als generisches „fehlt/falsch“, sondern als abgelehnten lokalen Key.

## Tests / Regressionen

- neuer Test `__tests__/localAdminKey.test.ts` fuer:
  - vorhandener lokaler Key + `missing or invalid admin` => `rejected`,
  - wirklich leerer Key => `missing`,
  - formal kaputter Key => `invalid`,
  - keine Secret-Leaks im Nutzertext.
- `__tests__/usePreview.serverContract.test.tsx` prueft jetzt zusaetzlich:
  - Remote-Preview meldet einen vorhandenen, aber serverseitig abgelehnten lokalen Key ehrlich als `rejected`,
  - ein formal kaputter lokaler Key blockiert bereits vor dem Remote-Call als `invalid`.
- `__tests__/useCiLiteWorkflow.behavior.test.tsx` prueft, dass CI Lite bei 401/`missing or invalid admin key` denselben lokalen Ablehnungsgrund zeigt statt „lokaler Key fehlt“.

## Nicht Teil dieses Patches

- keine Aenderung am Security-Modell oder an Server-Secrets
- kein Umbau von Preview-/Workflow-/Build-Architektur
- keine Dependency-Updates und keine unrelated Refactors
