# Patch 264: Edge errorResponse contract tests

**Datum:** 2026-02-24

## Ziel
Die App soll sich darauf verlassen können, dass Supabase Edge Fehlerantworten:
- stabil die gleiche JSON-Form haben (`ok=false`, `error`, optional `details`)
- niemals Secrets in `error` oder `details` ausgeben (auch bei nested arrays/objects)

## Änderungen
- **Neu:** `__tests__/edgeErrorResponseContracts.test.ts`
  - prüft Status + CORS Header
  - prüft Response-Shape
  - prüft Redaction für sensitive Keys (inkl. nested arrays)
  - prüft Pattern-Sanitization in `error`

## Erwartung
`npm run test:silent` bleibt grün und schützt vor Regressionen bei Edge Responses.
