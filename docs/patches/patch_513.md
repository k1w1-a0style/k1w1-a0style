# Patch 513: SecureKeyManager-/SecureTokenManager-Rollen bereinigt

## Ziel

Nach Patch 500 laeuft der produktive KI-Pfad bereits ausschliesslich ueber den Edge-Proxy `invokeK1w1Handler(...)`. Trotzdem spiegelte `contexts/AIContext/index.tsx` echte Provider-API-Keys weiterhin in `SecureKeyManager`, waehrend `lib/SecureTokenManager.ts` gar keine Runtime-Imports mehr hatte. Ziel dieses kleinen Folgepatches ist reine Rollenbereinigung: keine neue Key-Architektur, kein Rueckfall auf direkte Client-Provider-Pfade, kein Eingriff in Timeout-/Prompt-/History-/Orchestrator-Logik.

## Gepruefter Ist-Zustand

- `lib/SecureTokenManager.ts` hatte **keine** Runtime-Imports unter `lib/` oder `contexts/`.
- `lib/SecureTokenManager.ts` war nur noch durch seinen eigenen Test und historische Doku referenziert.
- `lib/SecureKeyManager.ts` hatte im Runtime-Scope nur noch einen Import in `contexts/AIContext/index.tsx`.
- `SecureKeyManager.getCurrentKey(...)`, `rotateKey(...)`, `moveKeyToFront(...)` und `addRotationListener(...)` wurden ausserhalb von Tests nicht mehr produktiv genutzt.
- Der produktive Orchestrator blieb bereits sauber auf `lib/orchestrator/index.ts` -> `invokeK1w1Handler(...)` begrenzt.

## Umsetzung

- `contexts/AIContext/index.tsx` spiegelt `config.apiKeys` nicht mehr in `SecureKeyManager` und registriert auch keinen Rotation-Listener mehr.
- `contexts/AIContext/index.tsx` persistiert Provider-API-Keys nur noch ueber den bestehenden `saveSecureApiKeys(...)`-Pfad; der Edge-Proxy-only-Hinweis bleibt dort explizit dokumentiert.
- `lib/SecureKeyManager.ts` ist klarer als Legacy-/Test-Helper ohne produktive Runtime-Rolle beschrieben.
- `lib/SecureTokenManager.ts` wurde entfernt.
- `lib/__tests__/SecureTokenManager.test.ts` wurde entfernt, weil damit nur noch ein toter Parallelpfad konserviert worden waere.

## Neue Absicherung gegen Drift

- `__tests__/patch513.keyManagerRuntimeBoundary.invariants.test.ts` sichert regressionsfest ab, dass:
  - der produktive KI-Pfad weiter nur ueber `invokeK1w1Handler(...)` laeuft,
  - `SecureKeyManager` nicht mehr in produktiven Runtime-Dateien importiert wird,
  - `AIContext` keine Provider-API-Keys mehr in den Legacy-Manager spiegelt,
  - `SecureTokenManager` nicht still als Runtime-Datei zurueckkehrt.

## Bewusst nicht im Scope

- keine neue Storage-/Auth-/Key-Architektur
- keine Rueckkehr zu direkten Provider-HTTP-Calls
- keine Aenderung an `lib/orchestrator/index.ts` ausser bestehender Invariant-Absicherung
- keine Aenderung an Timeout-/Abort-/Prompt-/History-/Planner-/Builder-/Validator-Logik
- kein Broad-Refactor von `AIContext`

## Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Ergebnis

- Produktiver KI-Traffic bleibt explizit Edge-Proxy-only.
- Echte Provider-API-Keys werden im Client nicht mehr zusaetzlich in einen Legacy-In-Memory-Manager gespiegelt.
- `SecureTokenManager` kann nicht mehr als scheinbar verfuegbarer Runtime-Pfad missverstanden werden.
- `SecureKeyManager` bleibt nur noch als klar eingegrenzter Legacy-/Test-Helper im Repo.
