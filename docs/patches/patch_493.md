# Patch 493 — GitHubReposScreen EAS-Link-/Repo-Semantik härten

## Ziel

Der GitHubReposScreen soll beim EAS-Link keine optimistische „linked/ok“-Wahrheit mehr anzeigen, sondern den fachlichen Zustand ehrlich unterscheiden:

- verifiziert verlinkt,
- Workflow fehlt,
- Projektdatei fehlt oder ist ungültig,
- Project-ID mismatch,
- Auth-/Permission-Problem,
- unknown / temporär nicht verifizierbar,
- geschrieben / Re-Check nötig.

## Umsetzung

### 1) Kleinen EAS-Link-Contract zentralisiert

Neue Utility: `screens/GitHubReposScreen/utils/easLinkContract.ts`

Sie modelliert jetzt als kleine Single Source of Truth:

- `verified`
- `workflow_missing`
- `project_missing`
- `project_invalid`
- `project_mismatch`
- `auth_error`
- `unknown`
- `pending_recheck`

Zusätzlich liefert sie kurze ehrliche UI-Labels/Details und lehnt sich fuer Auth-/Unknown-Klassifikation an die bestehende Verification-Semantik an.

### 2) Status-Check fachlich ehrlicher gemacht

`handleEasLinkStatusCheck(...)` nutzt nun den gemeinsamen Contract statt lokaler Sonderlogik.

Der Check prueft jetzt getrennt:

- existiert `.github/workflows/eas-link.yml`,
- existiert `eas-project.json`,
- ist die Datei JSON-gueltig,
- enthaelt sie eine `projectId`,
- stimmt diese `projectId` mit der erwarteten gespeicherten EAS Project ID ueberein.

Wichtige Folge:

- falsche `projectId` => `project_mismatch` statt false green,
- Auth-/Permission-Fehler => `auth_error` statt „fehlt“ oder „ok“,
- Workflow fehlt + Projektdatei vorhanden bleibt getrennt sichtbar statt als linked.

### 3) Link-Write-Flow gehärtet

`handleEasLink(...)` setzt nach dem Schreiben von `eas-project.json` nicht mehr blind „✅ EAS linked“.

Neuer Ablauf:

1. Status erst auf `pending_recheck` setzen,
2. Datei schreiben,
3. echten Re-Check fahren,
4. Ergebnis ehrlich mappen:
   - `verified` => verifiziert,
   - `unknown` nach Write => `pending_recheck`,
   - fachlicher Fehlerstatus bleibt fachlicher Fehlerstatus.

Dadurch erzeugt ein erfolgreicher Write allein keinen falschen Gruen-Status mehr.

### 4) UI-/Text-Semantik nachgezogen

Der RepoScreen zeigt nun:

- ehrliche Statuslabels statt generischem `OK`,
- ein separates kurzes Detail unter dem EAS-Link-Block,
- klare Formulierung, dass erst Workflow **und** passende `eas-project.json` als verifiziert gelten.

`workflow_missing`, `project_mismatch`, `auth_error` und `pending_recheck` sehen dadurch sichtbar anders aus als echte Verifikation.

## Tests

Neue fokussierte Jest-Regressionen decken ab:

1. Contract-Unterscheidung fuer `verified`, `workflow_missing`, `project_missing`, `project_invalid`, `project_mismatch`, `auth_error`, `unknown`,
2. falsche `projectId` wird als `project_mismatch` statt verified behandelt,
3. Auth-/Permission-Fehler werden nicht als missing/ok klassifiziert,
4. erfolgreicher Write bleibt `pending_recheck`, solange kein gruener Re-Check vorliegt,
5. RepoScreen rendert mismatch/workflow missing/auth problem nicht als normales verified/OK,
6. echter voll verifizierter Link bleibt sauber `verified`.

## Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
