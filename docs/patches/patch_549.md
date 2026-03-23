# Patch 549

## Ziel

Den vor Patch 548 sichtbaren OpenAI-/Groq-Modellkatalog im UI wiederherstellen, ohne die ehrlichen runtime-unterstuetzten Default-Modelle erneut zu verwischen.

## Umgesetzte Aenderungen

- `contexts/AIContext/models.ts`
  - OpenAI zeigt wieder `gpt-5-mini` und `gpt-4.1-nano`.
  - Groq zeigt wieder `openai/gpt-oss-20b` und `openai/gpt-oss-120b`.
  - Diese zusaetzlichen Optionen sind explizit als `Catalog only` markiert, damit der sichtbare Katalog groesser sein darf als der garantierte Runtime-Default-Satz.
  - `PROVIDER_DEFAULTS` bleiben unveraendert auf den aktuell serverseitig unterstuetzten Standardmodellen.
- `lib/__tests__/AIContext.integration.test.ts`
  - Regressionen sichern die wiederhergestellten Katalogeintraege und die unveraenderten OpenAI-/Groq-Defaults gemeinsam ab.

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `git diff --check`
