# Patch 662 — Refactor-Durchlauf 22 (edge/remaining typing follow-up)

## Ziel
Den naechsten kleinen produktionsnahen Typing-Block helper-first nachziehen, ohne API-/Workflow-/Keystore-Vertraege zu aendern.

## Umsetzung
- `infra/github/branchOps.ts::getBranches` liest Branch-Listen jetzt ueber `readJsonArraySafe(...)` + String-/SHA-/Boolean-Reader statt Direkt-Cast.
- `infra/github/workflows.ts` mappt Workflow-Listen, Run-Details, Jobs und Workflow-Runs ueber kleine Record-/Array-Reader statt lokalem `any`-/JSON-Parse-Rauschen.
- `supabase/functions/android-keystore-generate/helpers.ts` nutzt fuer den `node-forge`-Loader jetzt einen minimal getypten `ForgeRuntime`-Adapter statt `any`-Import/Callback.
- `infra/github/githubResponseHelpers.ts` wurde dafuer um `readJsonArraySafe(...)`, `readBooleanField(...)` und `readNumberField(...)` erweitert.

## Tests
- `__tests__/githubResponseHelpers.test.ts` deckt die neuen Array-/Boolean-/Number-Reader ab.

## Vertragswirkung
- Keine API-/Workflow-/Keystore-Vertragsaenderung.
- Nur lokale Parsing-/Loader-Typisierung enger gezogen.

## Naechster sinnvoller Schritt
- `lib/validators.ts`
- `supabase/functions/github-workflow-runs/index.ts`
- `supabase/functions/k1w1-handler/helpers.ts`
