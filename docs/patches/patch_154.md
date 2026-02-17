# Patch 154 — PR-5 Stage 3 (Build polling out of ProjectContext)

## Ziel
- **Build-Polling vollständig aus `contexts/ProjectContext.tsx` entfernen**.
- **Eine zentrale Polling-Quelle** verwenden (Hook `useBuildStatus` → `buildPollingService`).
- Keine Behavior-Änderung für UI: `currentBuild` wird weiter im Context gepflegt.

## Änderungen
- `contexts/ProjectContext.tsx`
  - Entfernt: internes `pollBuildStatusOnce`, Interval/Refs, AppState-Pause/Resume fürs Polling.
  - Neu: nutzt `useBuildStatus(activeJobId)`.
  - Neu: `useEffect` synchronisiert `currentBuild` aus Hook-Status + -Details.
  - Neu: best-effort `updateBuildInHistory` bei Status-Updates.
- `hooks/useBuildStatus.ts`
  - Polling-Intervall ist jetzt **im Hook** (kein globales Polling mehr).
  - AppState Pause/Resume im Hook.
- `project/services/buildPollingService.ts`
  - Normalisiert nun auch ältere `check-eas-build` Response-Shapes (job/data.job/urls/download_url/build_url).
- `lib/supabaseTypes.ts`
  - `urls.buildUrl?: string | null` ergänzt (UI Convenience).

## Verifikation
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

## Notes
- Das reduziert Doppel-Logik und macht spätere weitere Context-Splits einfacher.
