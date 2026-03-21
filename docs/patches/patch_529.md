# Patch 529

## Ziel
CI-Lite-Workflow-Run-Lookup robuster machen, damit echte GitHub Actions `workflow_dispatch`-Runs aus älteren Ziel-Workflows nicht mehr fälschlich als generischer Timeout enden, wenn der volle `job_id`-Correlation-Contract noch fehlt.

## Änderungen
- `workflowRunMatching.ts` führt jetzt eine gestufte Kandidatenlogik ein: exakter `job_id`-Marker bleibt Tier 1, danach folgen nur für `workflow_dispatch` streng begrenzte Fallbacks über `head_sha` bzw. einen einzelnen frischen Branch/Event-Kandidaten.
- Mehrdeutige frische Kandidaten binden nicht mehr blind an den ersten Run, sondern liefern eine explizite Ambiguitäts-Diagnose.
- `useCiLiteWorkflow.ts` sammelt Lookup-Diagnosen (`exactJobIdMatchFound`, `fallbackCandidateCount`, `ambiguous`, `contractMismatchLikely`, `selectedTier`) und nutzt sie für ehrlichere Fehlertexte statt pauschalem Timeout.
- `ciLiteWorkflowErrors.ts` kapselt die neuen Lookup-Fehlermeldungen für Timeout vs. Contract-Mismatch vs. Ambiguität.
- Jest-Coverage ergänzt für exakten Marker-Vorrang, sicheren Legacy-Fallback, Ambiguität, echten Timeout und den UI-Fall mit vorhandenem Legacy-Run ohne Marker.

## Verifikation
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
