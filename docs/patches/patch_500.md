# Patch 500 - produktiver AI-Flow ueber k1w1-handler Edge-Proxy

## Kontext

Der produktive Orchestrator sprach bisher trotz vorhandenem Supabase-Edge-Handler `k1w1-handler` weiterhin direkt mit Groq/OpenAI/Anthropic/Gemini/HuggingFace und nutzte dafuer lokal geladene Provider-API-Keys. Dadurch verliessen Provider-Secrets das Geraet direkt.

## Ziel

- Produktive KI-Requests aus der App laufen ueber `supabase.functions.invoke(...)` gegen `k1w1-handler`.
- Der Client sendet keine lokalen Provider-API-Keys mehr an externe Provider-Endpunkte.
- Die bestehende Client-Result-Form (`ok`/`text`/`error`/`provider`/`model`) bleibt kompatibel.
- Timeout-/Abort-/Edge-Fehler bleiben fuer den Chat-Flow verstaendlich und regressionsfest.

## Umsetzung

1. **Orchestrator-Requestpfad getauscht**
   - `lib/orchestrator/index.ts` ruft fuer produktive Provider-Calls jetzt den neuen kleinen Helper `invokeK1w1Handler(...)` statt der direkten Provider-HTTP-Helper auf.
   - Der Edge-Request-Body enthaelt nur `provider`, `model`, `quality` und `messages`.

2. **Neuer Edge-Invoke-Helper**
   - `lib/orchestrator/k1w1Edge.ts` kapselt:
     - `ensureSupabaseClient()`
     - lokales Laden des optional gespeicherten `K1W1_EDGE_ADMIN_KEY`
     - `supabase.functions.invoke(SUPABASE_EDGE_FUNCTIONS.K1W1_HANDLER, ...)`
     - kompatible Normalisierung von `ok/content/error/model/provider` in `OrchestratorResult`
     - Timeout-/Abort-/HTTP-/Fetch-Fehlertexte fuer den bestehenden Chat-Flow

3. **Tests fokussiert angepasst**
   - `lib/__tests__/orchestrator.test.ts` prueft jetzt explizit:
     - kein direkter Provider-Endpoint-Call mehr aus dem produktiven Orchestrator
     - Nutzung von `supabase.functions.invoke(..., k1w1-handler)`
     - kompatibles Edge-Response-Mapping
     - Timeout-/Abort-Pfade
     - Validator-/Quality-Pfad ueber denselben Edge-Proxy

## Geaenderte Dateien

- `lib/orchestrator/index.ts`
- `lib/orchestrator/k1w1Edge.ts`
- `lib/__tests__/orchestrator.test.ts`
- `README.md`
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_500.md`

## Checks

Geplant/auszufuehren:

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
