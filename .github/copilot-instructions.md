# Copilot / AI Instructions

This repository is an **automated Mobile APK Builder**.

Key constraints:
- Repo & branch are selected in-app. Do NOT pin branches in workflows.
- CI must be non-interactive. Avoid commands that prompt.
- Development/preview builds should use `android.withoutCredentials: true` (debug APK) to avoid keystore prompts.
- Diagnostics should catch: missing secrets, misconfigured workflows, accidental native folders (or incomplete ones), and incorrect EAS profiles.

Working mode (aligned with `AGENTS.md`):
- One round = one clearly bounded scope; no broad refactors outside that scope.
- Intermediate rounds: run only scope-relevant checks (plus required type/lint).
- Final round of a block (no follow-up needed): run the full relevant completion checks.
- Final report must always be complete, even in follow-up rounds after "weiter".

Preferred approach:
- Make small, reviewable changes.
- Keep templates & workflows in sync.
- Do not soften secret/import/export/cleanup safety contracts.
