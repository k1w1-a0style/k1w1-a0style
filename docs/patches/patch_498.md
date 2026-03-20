# Patch 498 — GitHubReposScreen SecretsSection / shared secret-status semantics

## Ziel

Die `SecretsSection` im GitHubReposScreen soll dieselbe Repo-Secret-Semantik wie Diagnostics sprechen.

Bisher war der Bereich fachlich zu grob:

- erfolgreiche Prüfung wurde nur über `names.includes(...)` modelliert
- ein Fetch-Fehler lief effektiv über `setNames([])` und erzeugte dadurch missing-artige UI
- RepoScreen und Diagnostics konnten dadurch unterschiedliche Wahrheiten anzeigen

Patch 498 hält den Scope bewusst klein und zieht nur diesen Semantik-Block gerade.

## Umsetzung

### 1) Kleiner Shared-Helper für Repo-Secret-Verification

Neu ist `lib/status/repoSecretVerification.ts`.

Der Helper kapselt die gemeinsame Ableitung:

- bestätigte Secret-Namensliste → `verified` oder `missing`
- 401/403 / Permission-Probleme → `auth_error`
- sonstige Load-Fehler → `unknown`
- optional `stale`, wenn ein Recheck nach bereits bestätigter Liste fehlschlägt

Damit sprechen RepoScreen und Diagnostics nicht mehr zwei getrennte Secret-Welten.

### 2) `SecretsSection` rendert keine Fake-Missing-UI mehr auf Fehlerpfaden

`screens/GitHubReposScreen/components/SecretsSection.tsx` setzt bei Fehlern nicht mehr fachlich auf `names=[]`.

Stattdessen:

- erfolgreiche Liste bleibt bestätigte Grundlage
- 401/403 zeigen `auth_error`-Warnsemantik
- generische Fehler zeigen `unknown`
- ein Fehlschlag nach zuvor bestätigter Liste bleibt als `stale` kenntlich

Die Summary-Copy sagt jetzt ehrlich, ob Secret-Namen bestätigt, fehlend, auth-blockiert, unklar oder veraltet sind.

### 3) Diagnostics nutzen denselben Helper weiter

`lib/diagnostics/buildPipelineDiagnostics.ts` nutzt fuer die Repo-Secret-Ableitung denselben Shared-Helper.

Damit ist die Kern-Semantik zwischen RepoScreen und Diagnostics vereinheitlicht, ohne eine größere Screen-Neuarchitektur anzufassen.

## Tests

Ergänzte/angepasste Jest-Regressionen decken ab:

1. erfolgreicher Fetch mit vorhandenem Secret → bestätigter/grüner Zustand
2. erfolgreicher Fetch ohne Pflicht-Secret → fehlend
3. 401/403 → `auth_error` / Warnsemantik statt fehlend
4. generischer Fehler → `unknown` statt fehlend
5. Erfolgs-Regression: vorhandene Secret-Anzeige bleibt korrekt

## Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
