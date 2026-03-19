# Patch 485 — CI-Lite-Tracking von Modal-Sichtbarkeit entkoppelt

## Was wurde geändert?

- `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`: fachlichen Run-Kontext (`trackedRunId` / `isTrackingRun`) von `visible` getrennt. Logs, Status, Polling und Artifact-Nachzug hängen jetzt am aktiven Run-Kontext statt an der Modal-Sichtbarkeit.
- `components/CiLiteHeaderButton/index.tsx` + `components/CiLiteHeaderButton/components/ActionButtons.tsx`: Header-Tap öffnet nur noch den Status; ein neuer CI-Lite-Run startet nur noch explizit über den Start-CTA im Modal. Autofix bleibt ebenfalls ein expliziter Modal-CTA.
- `hooks/useGitHubActionsLogs.ts`: beim Umschalten von `autoRefresh` auf `false` bleibt der zuletzt bekannte Run-/Log-Zustand erhalten, statt still geleert zu werden.
- Verhaltenstests ergänzt: `__tests__/ciLiteHeaderButton.behavior.test.tsx`, `__tests__/useCiLiteWorkflow.behavior.test.tsx`, zusätzliche Contract-Regression in `__tests__/useGitHubActionsLogs.contract.test.tsx`.

## Kritische Einordnung

- Bestehende Guards für `job_id`-/Event-/Branch-Matching und aktive Run-Persistenz bleiben unangetastet.
- Die implizite UI-Autostart-Kopplung wurde entfernt: Öffnen/Schließen des Modals verändert den fachlichen Tracking-Lebenszyklus nicht mehr.
- Der bestehende Autofix→CI-Lite-Chain-Run aus dem Workflow bleibt bewusst bestehen; geändert wurde nur die UI-seitige Trennung zwischen Status öffnen und neuen Run explizit starten.

## Verifikation

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/ciLiteHeaderButton.behavior.test.tsx __tests__/useCiLiteWorkflow.behavior.test.tsx __tests__/useGitHubActionsLogs.contract.test.tsx`
- `npm run test:silent`
