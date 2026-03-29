# Patch 600: Workflow-Admin-Key-Vertrag in CI-/Smoke-Skripten fail-closed gehaertet

## Ausgangslage

Im workflow-/build-/artifact-nahen Script-Scope existierten noch stille Legacy-Fallbacks:

- `scripts/ci-lite-env-load.sh`
- `scripts/ci-lite-smoke.sh`

Beide luden den Workflow-Key ueber dieselbe weiche Kette:

`K1W1_EDGE_WORKFLOW_ADMIN_KEY -> ADMIN_KEY -> K1W1_EDGE_ADMIN_KEY`

Dadurch konnten Fehlkonfigurationen maskiert werden (false-green), obwohl der dedizierte Workflow-Key-Vertrag fehlte.

## Umsetzung

1. **Legacy-Fallbacks entfernt (Script-Level):**
   - `WORKFLOW_ADMIN` liest in beiden Skripten jetzt ausschliesslich
     `K1W1_EDGE_WORKFLOW_ADMIN_KEY`.
   - Kein stiller Rueckfall auf `ADMIN_KEY` oder `K1W1_EDGE_ADMIN_KEY` mehr.

2. **Fehlermeldungen auf dedizierten Vertrag umgestellt:**
   - Beide Skripte brechen nun mit klarer Meldung ab, dass
     `K1W1_EDGE_WORKFLOW_ADMIN_KEY` erforderlich ist.
   - Die Meldung macht explizit, dass Legacy-/Generic-Fallbacks in diesem Scope
     nicht akzeptiert werden.

3. **Drift-/Contract-Check erweitert:**
   - `scripts/check_workflow_edge_contracts.sh` prueft jetzt zusaetzlich:
     - beide CI-Lite-Skripte sind vorhanden,
     - beide nutzen die harte Zuweisung auf
       `K1W1_EDGE_WORKFLOW_ADMIN_KEY`,
     - die alte 3er-Fallback-Kette darf nicht mehr vorkommen.

4. **Invariant-Test ergaenzt:**
   - Neuer Test `__tests__/patch600.workflowAdminScriptContract.invariants.test.ts`
     verankert denselben Vertrag auf Testebene.

## Ergebnis

- Workflow-/Build-/Artifact-Skriptpfade sind auf dedizierten Workflow-Key-Vertrag
  fail-closed gehaertet.
- Stille Legacy-/Generic-Fallbacks in diesen Pfaden sind entfernt.
- Ops-/Smoke-Laeufe koennen fehlende Workflow-Key-Konfiguration nicht mehr
  maskieren.
