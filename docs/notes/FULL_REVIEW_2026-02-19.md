# FULL REVIEW — 2026-02-19 (kritisch gegengeprüft)

Dieses Dokument ist die „Zusatz-Prüfung“ (Sonet/2nd pass) und wurde gegen den aktuellen Repo-Stand gegengeprüft.

**Wichtig:** Die ausführbare, aktuelle Restliste ist **immer** `docs/TODO.md`.

## Kurzfazit

- Die meisten Findings sind korrekt (SoT-Drift + 2 echte CI Lite Bugs).
- Ein Punkt wurde als „kritischer Bug“ formuliert, ist im Code aber eher **Performance/Style** (re-subscribe), nicht „funktional kaputt“.

## Bestätigte Findings (stimmen)

### CI Lite: Hardcoded Supabase Edge Endpoints

- Datei: `components/CiLiteHeaderButton.tsx`
  - Hardcoded: `github-workflow-runs`, `github-workflow-dispatch`

### Build: Hardcoded Edge Function Invocation

- Datei: `project/services/buildStartService.ts`
  - Hardcoded: `trigger-eas-build`

### Build Polling: Hardcoded Endpoint + Duplicate Helper

- Datei: `project/services/buildPollingService.ts`
  - Hardcoded: `check-eas-build`
  - Duplikat: lokale `getSupabaseEdgeUrl()` existiert, obwohl `lib/supabaseEdge.ts` bereits da ist

### Preview: Hardcoded Edge Function Invocation

- Datei: `hooks/usePreview.ts`
  - Hardcoded: `save_preview`

### Storage: Key Drift

- Files:
  - `screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts`
  - `screens/DiagnosticScreen/hooks/useDiagnosticScreen.ts`
- Literal: `diagnostic_last_ok` an zwei Stellen

### 🔴 Echter Bug: Dead Code `topContent` (useMemo)

- Datei: `components/CiLiteHeaderButton.tsx`
- `topContent` wird berechnet, aber im JSX nicht gerendert → unnötige Arbeit / tote UI-Struktur.

### 🔴 Echter Bug: Stale-Closure Risiko `applyPatchFromText`

- Datei: `components/CiLiteHeaderButton.tsx`
- Callback nutzt `githubRepo/branch` etc., deps sind unvollständig → kann bei Repo/Branch Wechsel in falsches Ziel pushen.

### 🟡 Cleanup: Polling Unmount

- Datei: `components/CiLiteHeaderButton.tsx`
- Timer läuft potenziell über Unmount weiter → Cleanup via `useEffect(() => () => stopPolling(), ...)`.

## Überzeichnet / nicht als „kritischer Bug“ bestätigen

### `useBuildStatus` AppState Listener „stale closure“

- Im aktuellen Code hängt der Effect von `status` ab, dadurch wird der Listener bei Statuswechsel neu registriert.
- Das ist nicht der klassische stale-closure Bug, sondern eher „häufiges Re-Subscribe“ (Optimierung möglich).

## Nächste Schritte

Siehe `docs/TODO.md`:
- Patch A (Bugfix)
- Patch B (Supabase SoT)
- Patch C (Storage Keys)
- Patch D (Robustness)
