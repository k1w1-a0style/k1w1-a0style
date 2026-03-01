# 00 — Overview (Single Source of Truth)

## Zweck
Diese Doku definiert den **verbindlichen Contract** für:
- globalen Zustand (Repo/Branch/BuildProfile + diagnostische Persistenz),
- Build-Pipeline (UI → Context → Service → GitHub/Supabase),
- Guardrails gegen Drift (Hardcoding/Fallbacks/lokale Schattenkopien).

Screens sind **nur Navigationshilfe**; der eigentliche Vertrag steht in:
- `01-state-contract.md`
- `02-build-pipeline.md`

---

## High-Level Flows

### A) Selection-Flow (Repo/Branch/BuildProfile)
1. User wählt Repo/Branch primär im Repo-Flow.
2. Schreibpfad persistiert in `ProjectData.linkedRepo/linkedBranch`.
3. `GitHubContext` spiegelt diese Werte (Mirror) in `activeRepo/activeBranch` + AsyncStorage Keys.
4. Build/Diagnostics lesen aus den globalen Werten (kein screen-lokaler SoT).

### B) Build-Flow (E2E)
1. Build UI prüft Preconditions (Tokens, Signing, Diagnostics, Repo/Branch).
2. Build startet über `ProjectContext.startBuild`.
3. `startBuildJob` pusht Dateien (best effort), setzt Workflows, triggert Edge Function.
4. Polling/Historie aktualisieren Build-Status im Context.

---

## Glossar (Contract-Begriffe)
- **SoT (Source of Truth):** Autoritative Datenquelle.
- **Single Writer:** Exakt definierter Schreibpfad pro Vertragswert.
- **Mirror State:** Abgeleiteter Zustand zur UX, nicht primäre Autorität.
- **Guardrail:** Explizite technische Sperre gegen ungültigen Start/Fallback.

---

## Evidence (Schlüsselstellen)

### Evidence 1 — ProjectData enthält die persistenten Kernfelder
**Datei:** `shared/types/project.ts`  
**Symbol:** `interface ProjectData`
```ts
export interface ProjectData {
  // ...
  linkedRepo?: string | null;
  linkedBranch?: string | null;
  preferredBuildProfile?: "development" | "preview" | "production" | null;
}
```

### Evidence 2 — GitHubContext mirrort linked* als SoT-Mirror
**Datei:** `contexts/GitHubContext.tsx`  
**Symbol:** `useEffect` (mirror linkedRepo/linkedBranch)
```ts
const linkedRepo = (projectData?.linkedRepo ?? "").trim() || null;
const linkedBranch = (projectData?.linkedBranch ?? "").trim() || null;

if (linkedRepo !== activeRepo) {
  setActiveRepo(linkedRepo);
}

if (linkedBranch !== activeBranch) {
  setActiveBranch(linkedBranch);
}
```

### Evidence 3 — Build-Preconditions nutzen persistente Status-Keys
**Datei:** `screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts`  
**Symbol:** `refreshPreconditions`
```ts
const diagVal = await AsyncStorage.getItem(STORAGE_KEYS.DIAGNOSTIC_LAST_OK).catch(() => null);
// ...
const [lintOk, typeOk] = await Promise.all([
  AsyncStorage.getItem(STORAGE_KEYS.CI_LITE_LINT_OK).catch(() => null),
  AsyncStorage.getItem(STORAGE_KEYS.CI_LITE_TYPECHECK_OK).catch(() => null),
]);
```

### Evidence 4 — Build wird zentral über startBuildJob ausgelöst
**Datei:** `contexts/ProjectContext.tsx`  
**Symbol:** `startBuild`
```ts
const started = await startBuildJob({
  project: pd,
  buildProfile: profile,
});

const jobId = started.jobId;
const githubRepoResolved = started.githubRepo;
```

## Quick Links
- Product overview: `docs/10-product-and-flows.md`
- Operator/QA runbook: `docs/runbooks/APP_RUNBOOK.md`
- Diagnostics → Fix: `docs/07-diagnostics-fix-playbook.md`
- Test coverage: `docs/08-test-coverage-matrix.md`
- Smoke plan: `docs/04-testing-smoke-plan.md`
- Gap tickets: `docs/09-gap-tickets.md`

