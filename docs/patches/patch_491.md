# Patch 491 — Diagnostics Fix-Engine Truthfulness / Result-Contract

## Ziel

Diagnostics-Fixes sollen Vorschlag, lokalen Apply, Workflow-Dispatch, Blocker, Teilfehler und Re-Check-Bedarf nicht mehr semantisch vermischen.

## Umsetzung

- Kleinen gemeinsamen Result-/Semantik-Contract in `lib/diagnostics/fixResultContract.ts` ergänzt.
- Der Contract unterscheidet jetzt explizit:
  - `advisory_only`
  - `patch_applicable`
  - `patch_applied`
  - `workflow_dispatched`
  - `blocked`
  - `failed`
  - `pending_recheck`
- Diagnostics-UI nutzt denselben Contract für Badge-/Action-/Hinweis-Texte:
  - `Patch-Fix verfügbar`
  - `Workflow-Fix verfügbar`
  - `KI-Fix verfügbar`
- `useDiagnosticFixRunner` meldet leere/no-op Patches nicht mehr als Erfolg.
- Ownership-/Pfad-/Apply-Blocker bleiben hart und enden jetzt ehrlich als `blocked`.
- Teilweise angewendete Fixes (z. B. Delete lief, nachfolgender Write schlug fehl) werden explizit als teilweise/fehlgeschlagen kommuniziert.
- Workflow-only-Fixes werden als angestoßen + recheck-pending dargestellt statt als lokal behoben.
- Issue-Detail-Sheet blendet Patch-Vorschau nur noch dann ein, wenn wirklich ein lokaler Patch existiert.

## Tests

Ergänzt/angepasst:

- `__tests__/diagnosticFixResultContract.test.ts`
- `__tests__/useDiagnosticFixRunner.fixSemantics.test.tsx`
- `__tests__/diagnosticScreen.sorting.test.tsx`

Abgedeckt sind u. a. Contract-Unterscheidung, leere/blockierte Applys, Partial-Fail-Kommunikation, Workflow-only-Pending und ehrliche UI-Badges.
