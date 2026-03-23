# Patch 542

## Titel
Timeout-/Leak-Follow-ups nach Patch 541 auf die gemeinsame Fetch-Linie gezogen.

## Was wurde geaendert?
- `hooks/previewHelpers.ts` nutzt fuer `save_preview` jetzt den gemeinsamen App-Helper `fetchWithTimeout(...)` statt lokaler `AbortController`-/`setTimeout`-Verwaltung; Timeout-Fehler bleiben fuer die UI weiter als ehrlicher Preview-Timeout sichtbar.
- `screens/CredentialsWizardScreen/hooks/credentialHelpers.ts` zieht `invokeEdgeJson(...)` auf denselben Timeout-Helper um, damit Wizard-Edge-Requests denselben Abort-/Timeout-Vertrag wie die restlichen App-Fetches verwenden.
- `hooks/useGitHubActionsLogs.ts` delegiert die Request-Timeouts ebenfalls an `lib/network/fetchWithTimeout.ts`; der Hook behaelt seinen eigenen aktiven AbortController fuer Input-Wechsel, spart aber lokale Timer-/Cleanup-Duplikate.
- `supabase/functions/preview_page/index.ts` nutzt fuer Lookup und Delete denselben Edge-Timeout-Helper statt `withTimeout(...)`, sodass der Preview-Page-Fetch-Vertrag mit den uebrigen Edge-Functions konsistent bleibt.
- `supabase/functions/github-workflow-logs/helpers.ts` nennt in der Logs-ZIP-Timeout-Meldung keine signierte Redirect-/Download-URL mehr.
- `supabase/functions/k1w1-handler/helpers.ts` verwendet fuer echte Provider-Upstreams (`Groq`, `Gemini`, `OpenAI`, `Anthropic`, `HuggingFace`) ein gemeinsames 45s-Limit statt verstreuter 20s-Werte.
- Neue/angepasste Tests sichern den `preview_page`-Lookup-Vertrag und den GitHub-Logs-Timeout ohne URL-Leak.

## Validierung
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `npm run test:silent -- --runInBand __tests__/previewEdgeErrorContract.test.ts __tests__/githubWorkflowLogs.security.invariants.test.ts __tests__/credentialsWizardInvokeEdgeJson.test.ts __tests__/useGitHubActionsLogs.contract.test.tsx __tests__/previewHelpers.test.ts`
