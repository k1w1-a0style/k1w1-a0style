# Patch 737: CI-Lite-Autofix Permission Scope minimiert

## Kontext / Root Cause

`k1w1-ci-lite-autofix.yml` lief mit `permissions: { contents: write, actions: write }`.
Im Workflow wird aber kein Actions-Mutations-Endpoint genutzt (kein Rerun/Cancel/Workflow-Edit), sondern nur:

- guarded Git-Writeback (`git push`) und
- `repository_dispatch`-Chain-Run via `gh api /repos/{owner}/{repo}/dispatches`.

Dafuer reicht `contents: write`; `actions: write` war unnötig breit.

## Umsetzung

1. In `.github/workflows/k1w1-ci-lite-autofix.yml` `actions: write` entfernt.
2. In `shared/workflows/managedWorkflowTemplates.ts` denselben Permission-Scope synchronisiert, damit kein Template-Drift entsteht.
3. Doku-/SoT-Nachzug fuer den neuen Stand in TODO/Review/Patchlog/Checklog.

## Wirkung / Risiko

- **Sicherheitswirkung:** Reduzierter Token-Scope im Autofix-Workflow (Least-Privilege).
- **Verhaltensrisiko:** sehr gering, da verwendete Operationen (`git push`, `repository_dispatch`) durch `contents: write` abgedeckt bleiben.
- **Bewusst nicht gemacht:** keine groesseren Workflow-Umbauten (Lockfile-Policy, Build/Release-Flows, Live-Operator-Themen).

## Verifikation

- Workflow-/Template-Drift- und Invariant-Skripte erneut gruen.
- Voller Repo-Check inkl. `verify:release` im lokalen Lauf gruen.
