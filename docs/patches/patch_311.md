# Patch 311 — EnhancedBuildScreen Type-Härtung (P1 Start)

## Ziel
Ersten priorisierten P1-Fix aus der Audit-Liste umsetzen: `any`-Casts im Build-Flow reduzieren, ohne Laufzeitverhalten zu ändern.

## Änderungen
1. **Build-Screen Hook typisiert**
   - `currentBuild.branch` und `preferredBuildProfile` ohne `as any` genutzt.
   - Filter- und History-Zugriffe auf bestehende, getypte Felder umgestellt.
   - Run-Detail-States (`runDetails`, `runJobs`) auf konkrete GitHub-Workflow-Typen gesetzt.

2. **Build-Typen ergänzt**
   - `CurrentBuildLike` um `branch` und `buildProfile` erweitert.

3. **Helper-Rückgaben präzisiert**
   - `fetchRunDetailsBundle` gibt jetzt `WorkflowRunDetails` + `WorkflowJob[]` zurück statt `any`.

## Verifikation
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

Alle drei Checks sind grün.
