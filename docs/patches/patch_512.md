# Patch 512: Legacy-Client-Provider im Orchestrator entfernt

## Ziel

Nach der produktiven Umstellung auf den Edge-Proxy-Pfad ueber `lib/orchestrator/k1w1Edge.ts` / `invokeK1w1Handler(...)` sollten die verbliebenen direkten Client-Provider-Helfer im App-Orchestrator nicht weiter als missverstaendlicher Altpfad im Repo liegen bleiben. Der Scope bleibt bewusst klein: produktiven Flow schuetzen, tote direkte Client-Provider-Dateien entfernen, `SecureKeyManager` nicht blind loeschen.

## Gepruefter Ist-Zustand

- `lib/orchestrator/index.ts` nutzt produktiv bereits nur noch `invokeK1w1Handler(...)`.
- `lib/orchestrator/providers/*` wurde im Runtime-Scope nicht mehr importiert.
- Verbleibende Nutzungen der alten Client-Provider-Dateien lagen nur noch in:
  - `lib/__tests__/openaiProvider.test.ts`
  - `lib/__tests__/geminiProvider.test.ts`
- `lib/SecureKeyManager.ts` ist **nicht** komplett tot:
  - `contexts/AIContext/index.tsx` nutzt ihn weiter fuer lokalen Key-/Rotations-State und Persistenz-Sync.
  - Er ist damit kein produktiver Provider-Transportpfad mehr, aber weiterhin Teil des lokalen Client-Settings-/State-Flows.

## Umsetzung

- `lib/orchestrator/providers/anthropic.ts`
- `lib/orchestrator/providers/gemini.ts`
- `lib/orchestrator/providers/groq.ts`
- `lib/orchestrator/providers/huggingface.ts`
- `lib/orchestrator/providers/openai.ts`

Diese alten direkten Client-Provider-Helfer wurden entfernt.

- `lib/__tests__/openaiProvider.test.ts`
- `lib/__tests__/geminiProvider.test.ts`

Diese nur noch an den entfernten Altpfad gebundenen Tests wurden ebenfalls entfernt.

- `lib/SecureKeyManager.ts` dokumentiert jetzt explizit seine Restrolle als lokaler Key-/Rotations-State nach der Edge-Proxy-Umstellung.
- `contexts/AIContext/index.tsx` markiert explizit, dass produktive KI-Requests seit Patch 500 ausschliesslich ueber den Edge-Proxy laufen und `SecureKeyManager` dort nur noch fuer lokalen Settings-/Persistenz-State gespiegelt wird.

## Neue Absicherung gegen Drift

- `__tests__/patch512.orchestratorLegacyClientProviders.invariants.test.ts` sichert regressionsfest ab, dass:
  - `lib/orchestrator/index.ts` weiter nur `invokeK1w1Handler(...)` nutzt,
  - das alte Verzeichnis `lib/orchestrator/providers/` nicht zurueckkehrt,
  - produktive Runtime-Dateien unter `lib/` und `contexts/` keine direkten Client-Provider-Imports mehr enthalten,
  - `SecureKeyManager` klar als lokaler Restpfad und nicht als produktiver Transportpfad dokumentiert bleibt.

## Bewusst nicht im Scope

- keine Aenderung an `lib/orchestrator/index.ts`-Produktlogik ausser der Absicherung des bestehenden Edge-Pfads
- keine Rueckkehr zu direkten Provider-HTTP-Calls
- keine neue Provider-Architektur
- keine Aenderung an Auth-/Timeout-/Abort-/History-/Prompt-Logik
- kein Broad-Refactor von `AIContext`
- kein Entfernen von `SecureKeyManager`, weil er im lokalen Client-State weiterhin aktiv ist

## Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Ergebnis

- aktiver Produktpfad und entfernter Client-Altpfad sind im Orchestrator-Bereich jetzt sauberer getrennt
- tote direkte Client-Provider-Implementierungen sind nicht mehr im Repo
- `SecureKeyManager` bleibt bewusst nur fuer den lokalen Client-State erhalten
- ein gezielter Invariant-Test blockiert, dass direkte Client-Provider-Aufrufe still in den produktiven Runtime-Scope zurueckkehren
