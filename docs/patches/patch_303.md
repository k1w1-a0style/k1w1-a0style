# Patch 303

## Was drin ist

### RepoScreen: EAS-Link wieder da
- **EAS-Link Section** im RepoScreen wiederhergestellt.
- Zeigt einen **Status** (OK / Fehlt / Unbekannt) und prüft automatisch beim Repo/Branch-Wechsel.
- Feld für **EAS Project ID (optional)**.
- Button **"EAS Projekt erstellen/verbinden"** ruft die bestehende `handleEasLink()`-Logik auf.

### CI / Workflow-Dispatch 404: Auto-Bootstrap
- `supabase/functions/github-workflow-dispatch` kann jetzt bei **404 (workflow not found)** einmalig den Workflow **aus den SoT-Templates** erstellen/aktualisieren und danach **erneut dispatchen**.
- Templates kommen aus `infra/github/workflowTemplates.ts` (Single Source of Truth).
- Response enthält optional `bootstrapped: true`, wenn ein Workflow on-the-fly installiert wurde.

## Dateien
- `screens/GitHubReposScreen/index.tsx`
- `supabase/functions/github-workflow-dispatch/index.ts`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_303.md`
