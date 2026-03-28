# Patch 602: CI-Lite-Smoke auf JWT+Scoped-Key-Vertrag und expliziten Ref fail-closed gehaertet

## Ausgangslage

`scripts/ci-lite-smoke.sh` verletzte noch den gehaerteten Edge-Vertrag fuer workflow-/build-/artifact-nahe Routen:

- Calls an `github-workflow-dispatch` / `github-workflow-runs` / `github-workflow-logs` liefen nur mit `x-k1w1-admin-key`.
- `Authorization: Bearer <jwt>` fehlte trotz `verify_jwt=true` im Root-Contract.
- Der Ref war still auf `main` defaultbar (`[ref]`), statt explizit gefordert zu werden.

## Umsetzung

1. **JWT-Pflicht fuer Smoke-Calls eingefuehrt**
   - `scripts/ci-lite-smoke.sh` fordert jetzt fail-closed `K1W1_EDGE_WORKFLOW_JWT`.
   - Alle workflow-/build-/artifact-nahen Edge-POSTs laufen zentral ueber `edge_post(...)` mit:
     - `Authorization: Bearer ${K1W1_EDGE_WORKFLOW_JWT}`
     - `x-k1w1-admin-key: ${K1W1_EDGE_WORKFLOW_ADMIN_KEY}`

2. **Expliziter Ref statt stilles `main`**
   - CLI-Vertrag ist jetzt: `Usage: ... <owner/repo> <workflow.yml> <ref>`.
   - Fehlender Ref bricht mit klarer Usage-/Contract-Meldung ab (`exit 2`).
   - Der stille `main`-Default ist entfernt.

3. **Env-Loader auf denselben JWT-Vertrag gezogen**
   - `scripts/ci-lite-env-load.sh` validiert jetzt ebenfalls `K1W1_EDGE_WORKFLOW_JWT` fail-closed.
   - Ausgabe dokumentiert beide Pflichtwerte als gesetzt (`WORKFLOW_ADMIN` + `WORKFLOW_JWT`).

4. **Checks/Invariants nachgezogen**
   - `scripts/check_workflow_edge_contracts.sh` prueft zusaetzlich:
     - JWT-Variable in Env-Load + Smoke,
     - Bearer-Header im Smoke-Script,
     - kein `REF="${3:-main}"` mehr,
     - verpflichtende `<ref>`-Usage.
   - Neuer Invariant-Test:
     - `__tests__/patch602.ciLiteSmokeJwtRefContract.invariants.test.ts`

5. **Doku synchronisiert**
   - README, Checklog, Patchlog Root, Build-Readiness, Risk-Hotspots und Edge-Status spiegeln den JWT+Scoped-Key+explicit-ref-Vertrag.

## Ergebnis

- `ci-lite-smoke.sh` passt wieder zum fail-closed Edge-Contract (`verify_jwt=true` + scoped admin key).
- Kein stiller `main`-Fallback fuer workflow dispatch / smoke.
- JWT-/Ref-Vertrag ist in Script, Checks, Invariants und Doku konsistent abgesichert.
