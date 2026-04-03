# Patch 732

Datum: 2026-04-03

## Ziel
Kleine, sichere Repo-Haertung ohne Live-Supabase-Aenderungen:
- fail-closed fuer Repo-/Ref-Allowlist
- konsistente `actions/upload-artifact` Full-SHA-Pins
- lokaler HTML-/Eval-Preview-Fallback in Production deaktiviert
- TODO-SoT ehrlich auf aktuellen Befund korrigiert

## Umsetzung
1. `supabase/functions/_shared/github.ts`
   - `isAllowedGithubRepo(...)` ist jetzt fail-closed, wenn `K1W1_ALLOWED_GITHUB_REPOS` fehlt/leer ist.
2. `supabase/functions/trigger-eas-build/index.ts`
   - `isAllowedRef(...)` blockiert fehlende/leere `K1W1_ALLOWED_REF_REGEX`.
3. `supabase/functions/github-workflow-dispatch/index.ts`
   - `isAllowedRef(...)` blockiert fehlende/leere `K1W1_ALLOWED_REF_REGEX`.
4. Workflows/Templates
   - `actions/upload-artifact` auf `ea165f8d65b6e75b540449e92b4886f43607fa02` vereinheitlicht.
5. `lib/sandpackBuilder.ts` + `lib/sandpackHelpers.ts` + `hooks/usePreview.ts`
   - expliziter Guard: unsafe local eval nur noch bei expliziter Freigabe (`allowUnsafeLocalEval`) bzw. Testmodus.
   - Production-/Release-Pfad liefert statische, klare Disabled-Meldung statt Runtime-Eval.
6. `docs/TODO.md`
   - SoT auf aktuelle offene Punkte aktualisiert, inkl. externer Admin-/Zugangsbedarfe.

## Verifikation
- `npm run typecheck`
- `npm run typecheck:edge`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/edgeAllowlist.failClosed.test.ts lib/__tests__/sandpackBuilder.test.ts`
- `npm run verify:release`
- `bash scripts/check_patch_docs_sync.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_template_drift.sh`

## Nicht in diesem Patch
- keine Live-Supabase-Migrationen
- kein Deploy / kein `db push`
- keine Dashboard-Annahmen ohne belegbaren Zugriff
