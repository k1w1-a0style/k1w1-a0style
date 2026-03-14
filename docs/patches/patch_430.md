# Patch 430 — KI-Provider Live-Reachability-Audit (ehrlich, ohne Scheinsicherheit)

## Ziel
Nach dem vorherigen Default-/Provider-Fix den aktuellen Zustand **realer Online-Erreichbarkeit** für die im `k1w1-handler` konfigurierten Provider sauber prüfen, ohne die bestehende Konfigurationslogik breit umzubauen.

## Durchgeführte Live-Checks
- Neuer minimaler Auditor-Runner: `scripts/live_provider_smoke.mjs`
  - liest die aktuell wirksamen Speed-Defaults direkt aus `supabase/functions/k1w1-handler/helpers.ts`
  - führt je Provider einen realen Online-Smoke-Request gegen den jeweiligen Provider-Endpunkt aus
  - trennt sauber zwischen
    - `missing_secret` (kein Key vorhanden)
    - `provider_error` (HTTP-Fehler trotz Key)
    - `ok` (Antwort erhalten)

Ausführung in dieser Umgebung:
- Ergebnis: Für **alle 5 Provider** `missing_secret` (keine Server-Keys im Laufzeit-Env vorhanden), daher keine Live-Aussage über tatsächliche Modell-Erreichbarkeit möglich.

## Minimal notwendige Härtungen
### 1) Verständlichere Upstream-Fehler im Edge-Handler
Datei: `supabase/functions/k1w1-handler/helpers.ts`
- Kleine helper-Funktion `providerHttpError(...)` ergänzt.
- Upstream-HTTP-Fehler enthalten jetzt konsistent:
  - Provider
  - HTTP-Status
  - **betroffenes Modell** (`model=...`)
  - Provider-Response-Body

Nutzen:
- klare Trennung, ob Fehler an Secret, Modell-ID oder Provider-Vertrag liegt
- bessere Auditierbarkeit ohne Architekturänderung

### 2) Korrektes zurückgegebenes Modell nach Groq-Prefix-Fallback
Datei: `supabase/functions/k1w1-handler/helpers.ts`
- Wenn bei Groq ein `groq/<id>`-Modell auf `<id>` fallbackt, liefert der Handler jetzt das **tatsächlich verwendete** Modell im Response zurück.

Nutzen:
- keine irreführende Erfolgsmeldung mit nicht-genutzter Modell-ID
- ehrlicheres Telemetrie-/Debug-Verhalten

## Tests (deterministisch, lokal)
Neue Datei: `__tests__/k1w1Handler.liveReachabilityContracts.test.ts`
- prüft, dass die Fehlervertrags-Härtung (`providerHttpError`, `model=...`) im Handler vorhanden bleibt
- prüft den Groq-Resolved-Model-Return nach Fallback

Kein Versuch, Online-Erreichbarkeit als Jest-Test zu „simulieren“.

## Betroffene Dateien
- `scripts/live_provider_smoke.mjs` (neu)
- `supabase/functions/k1w1-handler/helpers.ts`
- `__tests__/k1w1Handler.liveReachabilityContracts.test.ts` (neu)
- `docs/patches/patch_430.md` (neu)
- `docs/patches/PATCHLOG_ROOT.md`
- `PROJECT_CHECKLOG.md`
