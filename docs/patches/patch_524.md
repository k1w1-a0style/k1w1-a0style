# Patch 524 — CI-Lite-Chain-Run-Korrelation konsistent ueber expliziten `job_id`-Marker

## Ziel

Die verbleibende Mehrdeutigkeit beim Autofix→CI-Lite-Folge-Run wird ohne Architekturumbau
geschlossen: der Header darf den Folge-Run nicht mehr nur ueber `head_sha` an den ersten
frischen Run binden, sondern muss denselben expliziten `job_id`-Marker wie im manuellen
`workflow_dispatch`-Pfad verwenden.

## Root Cause

- `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts` setzte fuer den Chain-Run-Pollingpfad
  `requireJobIdMarker: false`.
- Dadurch konnte `matchesWorkflowRunContract(...)` einen frischen `repository_dispatch`-Run allein
  ueber `sourceHeadSha` akzeptieren, auch wenn dessen Run-Name keinen passenden `job_id`-Marker
  trug.
- Bei seltenen, aber real moeglichen parallelen bzw. schnellen Retry-Runs auf demselben Branch mit
  identischem `head_sha` konnte der Header deshalb an den falschen Folge-Run binden.

## Umsetzung

1. `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`
   - der Chain-Run-Pfad fordert explizit `requireJobIdMarker: true`
   - der Hook nutzt fuer das Run-Matching den kleinen benachbarten Helper
     `components/CiLiteHeaderButton/hooks/workflowRunMatching.ts`
2. `components/CiLiteHeaderButton/hooks/workflowRunMatching.ts`
   - `matchesWorkflowRunContract(...)` verlangt fuer marker-pflichtige Suchen einen echten
     `job_id`-Treffer und nutzt `sourceHeadSha` nur noch als zusaetzlichen Guard, wenn ein Run
     bereits marker-passend ist
   - `chooseWorkflowRunCandidate(...)` sortiert marker-passende Kandidaten weiterhin bevorzugt auf
     exaktes `head_sha`, ohne je auf head-sha-only zurueckzufallen
3. `__tests__/ciLiteChainRunCorrelation.test.ts`
   - deckt explizit ab, dass `head_sha` allein nicht mehr reicht
   - deckt konkurrierende frische Runs mit gleicher SHA ab
   - deckt den unveraenderten manuellen `workflow_dispatch`-Pfad mit explizitem Marker ab
4. `__tests__/ciLiteHeaderWorkflow.invariants.test.ts`
   - haelt den aktualisierten Hook-Vertrag fuer Chain-Run + Guard-Kommentar regressionsfest

## Tests / Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Risiko / Scope

- Kein Umbau an Repo-Allowlist, Preview, Backup, Build oder Polling-Architektur.
- Kein Eingriff in AbortController-/Log-Heuristik, weil fuer diesen Fix nicht noetig.
- `head_sha` bleibt nur noch ein sekundärer Guard/Sorter; der primaere Korrelationsanker ist
  wieder der explizite `job_id`-Marker.
- Der kleine Review-Nachzug zur Testbarkeit ist hier bewusst **Teil desselben Patch 524** und
  keine separate Patch-Wahrheit.
