# Patch 743 — Secret-Hotfixes fuer AppInfo Import/Export/Backup

## Ziel

Kleiner, sicherer Hotfix-Durchlauf fuer den Secret-/Import-/Export-Block:
- kein Klartext-Exportpfad fuer AI-/Provider-API-Keys im API-Config-Export
- bessere Temp-Datei-Hygiene in AppInfo Import-/Export-Flows
- weniger unnoetige Secret-Duplikation im Secure-Backup-Payload

## Umsetzung

1. `exportAPIConfig(...)` exportiert jetzt eine explizit redaktierte Config (`apiKeys` immer leere Arrays), statt den Runtime-Config-Blob unveraendert in eine Datei zu schreiben.
2. API-Config-Import/Export sowie Encrypted-Scoped-Backup-Import/Export raeumen temporaere Cache-Dateien nach Nutzung idempotent auf (`FileSystem.deleteAsync(..., { idempotent: true })` im `finally`).
3. Secret-Backup-Payload erzeugt keine zusaetzliche `ciSecrets`-Spiegelung aller Tokens mehr; Restore bleibt kompatibel, weil der Import weiterhin `tokens` priorisiert und nur legacy-fallback auf `ciSecrets` nutzt.
4. Alert-Text beim API-Config-Import ist auf den neuen Sicherheitsvertrag angepasst (Konfiguration ja, API-Keys nein).

## Tests

- `npm run typecheck`
- `npm test`
- `npm run lint:ci`
- `npm run typecheck:edge`
- `npm run typecheck:strict`
- `npm run docs:lint`
- `npm run docs:check:contracts`
- `npm run verify:release`

## Nicht-Ziele

- Kein Broad-Refactor ausserhalb des AppInfo Secret-/Import-/Export-Scopes.
- Kein Aufreissen separater groesserer Legacy-/Storage-Bloecke ausserhalb dieses Hotfix-Blocks.
