# Patch 595: npm-Warning-Analyse (`Unknown env config "http-proxy"`) und Tooling-Stabilisierung

## Ziel
- Die reproduzierbare npm-Warnung sauber analysieren:
  - `npm warn Unknown env config "http-proxy"`
- Nur dann repo-seitig fixen, wenn die Ursache im Repo liegt.
- Sicherstellen, dass die zuletzt gefixten Drift-Checks weiter gruen bleiben.

## Reproduktion
Warnung tritt reproduzierbar auf bei:
- `npm run test:silent`
- `npm run lint:ci`
- `npm run typecheck`

## Analyse

### 1) npm-/Env-Inspektion
- `npm config list -l` zeigt die Warnung bereits vor dem eigentlichen Kommando-Output.
- Dort erscheinen Proxy-Config-Werte im `env`-Block.
- Die Shell-Umgebung enthaelt u.a.:
  - `HTTP_PROXY` / `HTTPS_PROXY`
  - `http_proxy` / `https_proxy`
  - `npm_config_http_proxy` / `npm_config_https_proxy`

### 2) Repo-Scan
Gezielter Scan auf:
- `http-proxy`, `https-proxy`
- `npm_config_http_proxy`, `npm_config_http-proxy`
- `npm_config_https_proxy`, `npm_config_https-proxy`
- `npm config set`, `HTTP_PROXY`, `HTTPS_PROXY`

Ergebnis:
- keine repo-seitige Injection der deprecated npm-env-Varianten (`npm_config_http-proxy` / `npm_config_https-proxy`)
- keine `.npmrc` im Repo
- keine relevanten Script-/Workflow-Exporte, die diese Warnung erklaeren

## Ursache / Klassifikation
- **Externer Umgebungsrestpunkt** (Host-/Runner-Environment), nicht repo-lokal verursacht.
- Daher bewusst **kein Produkt-/Tooling-Codefix auf Verdacht**.

## Umgesetzte Stabilisierung
1. Dokumentation in README/Checklog/Patchlog + dieser Patch-Notiz aktualisiert.
2. Neuer Invariant-Test `__tests__/npmProxyWarning.source.invariants.test.ts`:
   - verhindert, dass repo-seitige Workflows/Skripte spaeter deprecated npm-proxy-env-Namen injizieren.

## Drift-Checks
Weiterhin gruen:
- `scripts/check_eas_manual_trigger_controls.sh`
- `scripts/check_eas_strict_lockfile_policy.sh`

## Empfohlene Host-/CI-Maßnahme (außerhalb Repo)
- Runner-/Shell-Proxy-Setup auf valide npm-Konfiguration umstellen (keine deprecated env-config Namen).
- Falls notwendig: Proxy nur ueber `HTTP_PROXY`/`HTTPS_PROXY` (oder sauberem npm-Konfig-Pfad) setzen und veraltete npm-env-Keys aus globaler Umgebung entfernen.
