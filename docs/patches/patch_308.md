# Patch 308 — OpenAI Payload Hardening Regression-Test + TODO/Status Sync

## Ziel
Kleiner Safety-Patch ohne Runtime-Änderung:
- sicherstellen, dass der OpenAI-Request keine unsupported Felder (z. B. `verbosity`) enthält
- bestehendes Verhalten für Reasoning-Modelle (`o*`) gegen Regression absichern
- TODO-/Status-Doku auf aktuellen Stand bringen

## Änderungen

### 1) Neue Regression-Tests für OpenAI Provider
- `lib/__tests__/openaiProvider.test.ts`
  - prüft, dass `callOpenAI(...)` **kein** `verbosity`-Feld sendet
  - prüft, dass bei non-reasoning Modellen `temperature` gesetzt wird
  - prüft, dass bei Reasoning-Modellen (`o3-mini`) `temperature` **nicht** gesendet wird

### 2) Docs-Status aktualisiert
- `docs/TODO.md`
  - offene Checkboxen für Patch 219 / 226 auf erledigt gesetzt (entsprechend bereits umgesetztem Stand)

- `docs/patches/PATCHLOG_ROOT.md`
  - Patch 308 ergänzt

- `PROJECT_CHECKLOG.md`
  - Patch-308 Eintrag ergänzt

## Checks
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
