# Patch 574 – Kleiner Rehydration-/API-Key-Helper-Extract aus `AIContext`

Datum: 2026-03-28  
Branch: `codex`

## Ziel

Kleiner, reviewbarer Entflechtungsschritt im zentralen Hotspot `contexts/AIContext/index.tsx`, ohne Context-Umbau:

- einen klaren pure-logic-Block fuer API-Key-Rehydration (SecureStore vs. Legacy-Config) extrahieren
- doppelte Inline-Normalisierung bei API-Key-Listen reduzieren
- den bestehenden Rehydration-/Fallback-Vertrag unveraendert halten

## Umgesetzte Aenderungen

### 1) Pure-Helper in `contexts/AIContext/helpers.ts` erweitert

Neu eingefuehrt:

- `normalizeApiKeys(...)`
  - normalisiert providerweise auf `string[]`
  - trimmt Eintraege, entfernt leere Werte
  - fail-safe bei invaliden/non-array Werten

- `hasAnyApiKeys(...)`
  - kleiner zentraler Guard fuer "mindestens ein Key vorhanden"

- `resolveRehydratedApiKeys(...)`
  - kapselt den bisherigen Legacy-Migrationsvertrag:
    - SecureStore bleibt autoritativ, sobald dort irgendein Key existiert
    - nur wenn SecureStore komplett leer ist und Legacy-Config Keys enthaelt, wird Migration ausgelost

Bestehende Helper nutzen jetzt denselben Normalizer:

- `loadSecureApiKeys(...)`
- `saveSecureApiKeys(...)`

### 2) `AIContext` bleibt Orchestrator

`contexts/AIContext/index.tsx` wurde minimal angepasst:

- Inline-Block fuer `hasSecureAny` / `hasLegacyAny` / `finalKeys` wurde durch `resolveRehydratedApiKeys(...)` ersetzt
- Persistenz-/Rehydration-Flow, React-State-Flow und externe Context-API bleiben unveraendert

## Tests / Regressionen

Neu: `__tests__/aiContext.helpers.test.ts`

Abgesichert werden gezielt:

1. API-Key-Normalisierung (trim/fail-safe/non-array)
2. Legacy-Migration nur bei leerem SecureStore
3. SecureStore bleibt autoritativ, sobald dort Keys vorhanden sind
4. zentraler `hasAnyApiKeys(...)`-Guard

Zusatz-Regression (bestehend):

- `__tests__/aiContext.persistence.test.tsx` (redacted/debounced Config-Persistenz)

## Checks

Ausgefuehrt:

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/aiContext.helpers.test.ts __tests__/aiContext.persistence.test.tsx __tests__/aiContext.qualityMode.test.ts`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`

## Restpunkte (bewusst unveraendert)

- `AIContext` bleibt weiterhin ein zentraler Orchestrator-Hotspot.
- Dieser Patch extrahiert bewusst nur den kleinen API-Key-Rehydration-/Normalisierungsblock und fuehrt keinen Architekturwechsel ein.
