# Copilot / AI Instructions

This repository is an **automated Mobile APK Builder**.

Key constraints:
- Repo & branch are selected in-app. Do NOT pin branches in workflows.
- CI must be non-interactive. Avoid commands that prompt.
- Development/preview builds should use `android.withoutCredentials: true` (debug APK) to avoid keystore prompts.
- Diagnostics should catch: missing secrets, misconfigured workflows, accidental native folders (or incomplete ones), and incorrect EAS profiles.

Preferred approach:
- Make small, reviewable changes.
- Keep templates & workflows in sync.
