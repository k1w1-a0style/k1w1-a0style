# Patch 497 — Diagnostics Repo-Secret-Contract / Title-Truthfulness

## Ziel

Die Pipeline-Diagnostics sollen Repo-Secrets nur dann als "unklar" behandeln, wenn der GitHub-Secret-Read wirklich fehlgeschlagen ist.

Wenn `listRepoSecretNames(...)` erfolgreich eine Namensliste liefert, muss daraus für die drei relevanten Repo-Secrets eine fachlich ehrliche Wahrheit entstehen:

- Name enthalten → **verifiziert / bestätigt**
- Name fehlt → **fehlend**
- `unknown` oder `auth_error` nur auf echten Fehlerpfaden

Außerdem dürfen Check-Titel keinen vorhandenen Secret-Status mehr behaupten, wenn die Diagnose gerade nur `unknown`, `auth_error` oder `stale` weiß.

## Umsetzung

### 1) Erfolgreiche Secret-Liste ergibt explizite Verification-States

In `lib/diagnostics/buildPipelineDiagnostics.ts` werden die drei Repo-Secrets

- `EXPO_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

bei erfolgreicher GitHub-Namensliste jetzt über den bestehenden `normalizeVerificationContract(...)` mit explizitem State gespeist:

- enthalten → `verified`
- nicht enthalten → `missing`

Dadurch fällt der bisherige Drift weg, bei dem `configured: true` ohne `verified: true` versehentlich in `unknown` landete.

### 2) Zustandsabhängige Secret-Titel statt false-green Copy

Die Secret-Checks verwenden jetzt zustandsabhängige Titel:

- `Repo Secret bestätigt: ...`
- `Repo Secret fehlt: ...`
- `Repo Secret Status unklar: ...`
- `Repo Secret Zugriff unklar: ...`
- `Repo Secret Status veraltet: ...`

Die Fix-Hinweise wurden im selben kleinen Scope sprachlich an den Zustand angepasst, damit `unknown`/`auth_error` nicht gleichzeitig wie "vorhanden" und "unklar" wirken.

### 3) Fehlerpfade bleiben unverändert ehrlich

Wenn `listRepoSecretNames(...)` mit 401/403 oder ähnlichen Permission-/Zugriffsfehlern scheitert, bleibt die Diagnose auf dem bestehenden Warn-/Auth-Pfad (`repo.secret.list`).

Es gibt bewusst **keine** größere Diagnostics-Architekturänderung, sondern nur die minimale Härtung der Secret-State-Ableitung und Copy.

## Tests

Gezielte Jest-Regressionen decken jetzt ab:

1. `SUPABASE_URL` aus erfolgreicher Namensliste → `pass` / bestätigt statt `unknown`
2. leere Namensliste → `missing` für Pflicht-/optionale Secrets mit passender Severity
3. 401/403 beim Secret-Read → Warn-/Auth-Pfad bleibt aktiv
4. `unknown`-/`auth_error`-Titel behaupten nicht mehr `Repo Secret vorhanden`
5. bestehender Missing-Regressionstest für `EXPO_TOKEN` bleibt grün

## Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
